import {
    BadRequestException,
    ConflictException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import {
    PdfProcessingError,
    PdfProcessorService,
} from './pdf-processor.service';
import { TextChunkerService } from './text-chunker.service';
import { EmbeddingsService } from '../ai/embeddings.service';

const publicDocumentSelect = {
    id: true,
    name: true,
    mimeType: true,
    size: true,
    status: true,
    pageCount: true,
    chunkCount: true,
    errorMessage: true,
    createdAt: true,
    updatedAt: true,
} as const;

@Injectable()
export class DocumentsService {
    private readonly logger = new Logger(DocumentsService.name);

    private readonly uploadRoot: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        private readonly pdfProcessor: PdfProcessorService,
        private readonly textChunker: TextChunkerService,
        private readonly embeddingsService: EmbeddingsService,
    ) {
        const uploadDirectory =
            this.configService.get<string>('UPLOAD_DIR') ?? 'storage/documents';

        this.uploadRoot = resolve(process.cwd(), uploadDirectory);
    }

    async remove(userId: string, documentId: string): Promise<void> {
        const document = await this.prisma.document.findFirst({
            where: {
                id: documentId,
                userId,
            },
            select: {
                id: true,
                storageKey: true,
            },
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        const absoluteFilePath = resolve(this.uploadRoot, document.storageKey);

        const uploadRootPrefix = `${this.uploadRoot}${sep}`;

        if (!absoluteFilePath.startsWith(uploadRootPrefix)) {
            this.logger.error(
                `Invalid storage path for document ${documentId}`,
            );

            throw new InternalServerErrorException('Failed to delete document');
        }

        const deleteResult = await this.prisma.document.deleteMany({
            where: {
                id: documentId,
                userId,
            },
        });

        if (deleteResult.count === 0) {
            throw new NotFoundException('Document not found');
        }

        try {
            await unlink(absoluteFilePath);
        } catch (error) {
            if (this.isFileNotFoundError(error)) {
                return;
            }

            this.logger.warn(
                `Database record was deleted, but the PDF file could not be removed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    async findAll(userId: string) {
        const documents = await this.prisma.document.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
            select: publicDocumentSelect,
        });

        return {
            documents,
        };
    }

    async upload(userId: string, file: Express.Multer.File) {
        const documentId = randomUUID();

        const storageKey = `${userId}/${documentId}.pdf`;

        const userDirectory = join(this.uploadRoot, userId);

        const absoluteFilePath = join(this.uploadRoot, storageKey);

        await this.prisma.document.create({
            data: {
                id: documentId,
                userId,
                name: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                storageKey,
                status: 'UPLOADING',
            },
        });

        try {
            await mkdir(userDirectory, {
                recursive: true,
            });

            await writeFile(absoluteFilePath, file.buffer, {
                flag: 'wx',
            });

            await this.prisma.document.update({
                where: {
                    id: documentId,
                },
                data: {
                    status: 'PROCESSING',
                    errorMessage: null,
                },
            });
        } catch (error) {
            await unlink(absoluteFilePath).catch(() => undefined);

            await this.markAsFailed(documentId, 'Failed to save the PDF file');

            this.logError(`Failed to save document ${documentId}`, error);

            throw new InternalServerErrorException(
                'Failed to save the PDF file',
            );
        }

        try {
            return this.processDocument(documentId, file.buffer);
        } catch (error) {
            const message =
                error instanceof PdfProcessingError
                    ? error.message
                    : error instanceof HttpException
                      ? error.message
                      : 'Failed to process document';

            await this.markAsFailed(documentId, message);

            this.logError(`Failed to process document ${documentId}`, error);

            if (error instanceof PdfProcessingError) {
                throw new UnprocessableEntityException(message);
            }

            if (error instanceof HttpException) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Failed to process document',
            );
        }
    }

    async retryProcessing(userId: string, documentId: string) {
        const document = await this.prisma.document.findFirst({
            where: {
                id: documentId,
                userId,
            },
            select: {
                id: true,
                status: true,
                storageKey: true,
            },
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        if (document.status !== 'FAILED') {
            throw new BadRequestException(
                'Only failed documents can be retried',
            );
        }

        const absoluteFilePath = resolve(this.uploadRoot, document.storageKey);

        const uploadRootPrefix = `${this.uploadRoot}${sep}`;

        if (!absoluteFilePath.startsWith(uploadRootPrefix)) {
            this.logger.error(
                `Invalid storage path for document ${documentId}`,
            );

            throw new InternalServerErrorException(
                'Failed to retry document processing',
            );
        }

        let fileBuffer: Buffer;

        try {
            fileBuffer = await readFile(absoluteFilePath);
        } catch (error) {
            if (this.isFileNotFoundError(error)) {
                await this.markAsFailed(
                    documentId,
                    'Original PDF file is no longer available',
                );

                throw new UnprocessableEntityException(
                    'Original PDF file is no longer available. Upload the document again.',
                );
            }

            this.logError(`Failed to read document ${documentId}`, error);

            throw new InternalServerErrorException(
                'Failed to read the PDF file',
            );
        }

        const updateResult = await this.prisma.document.updateMany({
            where: {
                id: documentId,
                userId,
                status: 'FAILED',
            },
            data: {
                status: 'PROCESSING',
                errorMessage: null,
            },
        });

        if (updateResult.count === 0) {
            throw new ConflictException(
                'Document processing has already been restarted',
            );
        }

        return this.processDocument(documentId, fileBuffer);
    }

    private async processDocument(documentId: string, fileBuffer: Buffer) {
        try {
            const extractedPdf = await this.pdfProcessor.extract(fileBuffer);

            const chunks = this.textChunker.createChunks(extractedPdf.pages);

            if (chunks.length === 0) {
                throw new PdfProcessingError('No text chunks were created');
            }

            await this.prisma.$transaction(async (transaction) => {
                await transaction.documentChunk.deleteMany({
                    where: {
                        documentId,
                    },
                });

                await transaction.documentPage.deleteMany({
                    where: {
                        documentId,
                    },
                });

                await transaction.documentPage.createMany({
                    data: extractedPdf.pages.map((page) => ({
                        documentId,
                        pageNumber: page.pageNumber,
                        text: page.text,
                    })),
                });

                await transaction.documentChunk.createMany({
                    data: chunks.map((chunk) => ({
                        documentId,
                        pageNumber: chunk.pageNumber,
                        chunkIndex: chunk.chunkIndex,
                        content: chunk.content,
                    })),
                });

                await transaction.document.update({
                    where: {
                        id: documentId,
                    },
                    data: {
                        status: 'PROCESSING',
                        pageCount: extractedPdf.pageCount,
                        chunkCount: chunks.length,
                        errorMessage: null,
                    },
                });
            });

            const storedChunks = await this.prisma.documentChunk.findMany({
                where: {
                    documentId,
                },
                orderBy: {
                    chunkIndex: 'asc',
                },
                select: {
                    id: true,
                    content: true,
                },
            });

            const embeddings = await this.embeddingsService.createMany(
                storedChunks.map((chunk) => chunk.content),
            );

            if (embeddings.length !== storedChunks.length) {
                throw new Error('Embedding count does not match chunk count');
            }

            const document = await this.prisma.$transaction(
                async (transaction) => {
                    for (
                        let index = 0;
                        index < storedChunks.length;
                        index += 1
                    ) {
                        const chunk = storedChunks[index];

                        const embedding = embeddings[index];

                        const vectorValue = `[${embedding.join(',')}]`;

                        await transaction.$executeRaw`
                            UPDATE "document_chunks"
                            SET "embedding" =
                                ${vectorValue}::vector
                            WHERE "id" =
                                ${chunk.id}
                        `;
                    }

                    return transaction.document.update({
                        where: {
                            id: documentId,
                        },
                        data: {
                            status: 'READY',
                            pageCount: extractedPdf.pageCount,
                            chunkCount: chunks.length,
                            errorMessage: null,
                        },
                        select: publicDocumentSelect,
                    });
                },
            );

            return {
                document,
            };
        } catch (error) {
            const message =
                error instanceof PdfProcessingError
                    ? error.message
                    : error instanceof HttpException
                      ? error.message
                      : 'Failed to process document';

            await this.markAsFailed(documentId, message);

            this.logError(`Failed to process document ${documentId}`, error);

            if (error instanceof PdfProcessingError) {
                throw new UnprocessableEntityException(message);
            }

            if (error instanceof HttpException) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Failed to process document',
            );
        }
    }

    private async markAsFailed(documentId: string, errorMessage: string) {
        await this.prisma.document
            .update({
                where: {
                    id: documentId,
                },
                data: {
                    status: 'FAILED',
                    errorMessage,
                },
            })
            .catch(() => undefined);
    }

    private logError(message: string, error: unknown) {
        this.logger.error(
            message,
            error instanceof Error ? error.stack : String(error),
        );
    }

    private isFileNotFoundError(error: unknown): boolean {
        return (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'ENOENT'
        );
    }
}
