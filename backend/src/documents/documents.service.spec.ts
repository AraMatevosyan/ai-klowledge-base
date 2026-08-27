import {
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DocumentsService } from './documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfProcessorService } from './pdf-processor.service';
import { TextChunkerService } from './text-chunker.service';
import { EmbeddingsService } from '../ai/embeddings.service';

type ProcessDocumentResult = {
    document: {
        id: string;
        status: string;
    };
};

type DocumentsServicePrivate = {
    processDocument(
        userId: string,
        documentId: string,
        fileBuffer: Buffer,
    ): Promise<ProcessDocumentResult>;
};

describe('DocumentsService.retryProcessing', () => {
    let service: DocumentsService;
    let uploadDirectory: string;

    const prisma = {
        document: {
            findFirst: jest.fn(),
            updateMany: jest.fn(),
            update: jest.fn(),
        },
    };

    const pdfProcessor = {
        extract: jest.fn(),
    };

    const textChunker = {
        createChunks: jest.fn(),
    };

    const embeddingsService = {
        createMany: jest.fn(),
    };

    beforeEach(async () => {
        uploadDirectory = await mkdtemp(join(tmpdir(), 'ai-kb-retry-'));

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DocumentsService,

                {
                    provide: PrismaService,
                    useValue: prisma,
                },

                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn().mockReturnValue(uploadDirectory),
                    },
                },

                {
                    provide: PdfProcessorService,
                    useValue: pdfProcessor,
                },

                {
                    provide: TextChunkerService,
                    useValue: textChunker,
                },

                {
                    provide: EmbeddingsService,
                    useValue: embeddingsService,
                },
            ],
        }).compile();

        service = module.get(DocumentsService);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        jest.resetAllMocks();

        await rm(uploadDirectory, {
            recursive: true,
            force: true,
        });
    });

    it('throws when the document does not exist or belongs to another user', async () => {
        prisma.document.findFirst.mockResolvedValue(null);

        await expect(
            service.retryProcessing('user-1', 'document-1'),
        ).rejects.toBeInstanceOf(NotFoundException);

        expect(prisma.document.findFirst).toHaveBeenCalledWith({
            where: {
                id: 'document-1',
                userId: 'user-1',
            },
            select: {
                id: true,
                status: true,
                storageKey: true,
            },
        });
    });

    it('throws when the document is not failed', async () => {
        prisma.document.findFirst.mockResolvedValue({
            id: 'document-1',
            status: 'READY',
            storageKey: 'user-1/document-1.pdf',
        });

        await expect(
            service.retryProcessing('user-1', 'document-1'),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(prisma.document.updateMany).not.toHaveBeenCalled();
    });

    it('throws when the original PDF is missing', async () => {
        prisma.document.findFirst.mockResolvedValue({
            id: 'document-1',
            status: 'FAILED',
            storageKey: 'user-1/missing.pdf',
        });

        prisma.document.update.mockResolvedValue({});

        await expect(
            service.retryProcessing('user-1', 'document-1'),
        ).rejects.toBeInstanceOf(UnprocessableEntityException);

        expect(prisma.document.update).toHaveBeenCalledWith({
            where: {
                id: 'document-1',
            },
            data: {
                status: 'FAILED',
                errorMessage: 'Original PDF file is no longer available',
            },
        });
    });

    it('prevents concurrent retry requests', async () => {
        const storageKey = 'user-1/document-1.pdf';

        const userDirectory = join(uploadDirectory, 'user-1');

        await mkdir(userDirectory, {
            recursive: true,
        });

        await writeFile(join(uploadDirectory, storageKey), '%PDF-1.4 fake PDF');

        prisma.document.findFirst.mockResolvedValue({
            id: 'document-1',
            status: 'FAILED',
            storageKey,
        });

        prisma.document.updateMany.mockResolvedValue({
            count: 0,
        });

        await expect(
            service.retryProcessing('user-1', 'document-1'),
        ).rejects.toBeInstanceOf(ConflictException);
    });

    it('restarts processing for a failed document', async () => {
        const storageKey = 'user-1/document-1.pdf';

        const userDirectory = join(uploadDirectory, 'user-1');

        const filePath = join(uploadDirectory, storageKey);

        await mkdir(userDirectory, {
            recursive: true,
        });

        await writeFile(filePath, '%PDF-1.4 fake PDF');

        prisma.document.findFirst.mockResolvedValue({
            id: 'document-1',
            status: 'FAILED',
            storageKey,
        });

        prisma.document.updateMany.mockResolvedValue({
            count: 1,
        });

        const privateService = service as unknown as DocumentsServicePrivate;

        const processDocumentSpy = jest.spyOn(
            privateService,
            'processDocument',
        );

        processDocumentSpy.mockResolvedValue({
            document: {
                id: 'document-1',
                status: 'READY',
            },
        });

        const result = await service.retryProcessing('user-1', 'document-1');

        expect(prisma.document.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'document-1',
                userId: 'user-1',
                status: 'FAILED',
            },
            data: {
                status: 'PROCESSING',
                errorMessage: null,
            },
        });

        expect(processDocumentSpy).toHaveBeenCalledTimes(1);

        expect(processDocumentSpy).toHaveBeenCalledWith(
            'user-1',
            'document-1',
            expect.any(Buffer),
        );

        const processedFile = processDocumentSpy.mock.calls[0]?.[2];

        expect(processedFile?.toString()).toBe('%PDF-1.4 fake PDF');

        expect(result).toEqual({
            document: {
                id: 'document-1',
                status: 'READY',
            },
        });
    });
});
