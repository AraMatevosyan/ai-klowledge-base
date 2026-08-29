import { Test, type TestingModule } from '@nestjs/testing';
import { EmbeddingsService } from '../ai/embeddings.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService, type SearchResult } from './search.service';
import { detectQueryIntent, QueryIntent } from './query-intent';

jest.mock('./query-intent', () => ({
    QueryIntent: {
        FACTUAL: 'FACTUAL',
        COMPARISON: 'COMPARISON',
        EXHAUSTIVE: 'EXHAUSTIVE',
        SUMMARY_SINGLE: 'SUMMARY_SINGLE',
        SUMMARY_ALL: 'SUMMARY_ALL',
    },

    detectQueryIntent: jest.fn(),
}));

const USER_ID = 'user-1';

const QUERY_EMBEDDING = [0.1, 0.2, 0.3];

function createSearchResult(
    overrides: Partial<SearchResult> = {},
): SearchResult {
    return {
        chunkId: 'chunk-1',
        documentId: 'document-1',
        documentName: 'Resume.pdf',
        pageNumber: 1,
        chunkIndex: 0,
        content: 'Document content',
        similarity: 0.8,
        ...overrides,
    };
}

describe('SearchService', () => {
    let service: SearchService;

    const prisma = {
        $queryRaw: jest.fn(),

        document: {
            findMany: jest.fn(),
        },
    };

    const embeddingsService = {
        createOne: jest.fn(),
    };

    const detectQueryIntentMock = jest.mocked(detectQueryIntent);

    beforeEach(async () => {
        jest.resetAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SearchService,

                {
                    provide: PrismaService,
                    useValue: prisma,
                },

                {
                    provide: EmbeddingsService,
                    useValue: embeddingsService,
                },
            ],
        }).compile();

        service = module.get(SearchService);

        detectQueryIntentMock.mockReturnValue('FACTUAL' as QueryIntent);

        embeddingsService.createOne.mockResolvedValue(QUERY_EMBEDDING);
    });

    describe('getAvailability', () => {
        it('returns document availability', async () => {
            prisma.$queryRaw.mockResolvedValue([
                {
                    documentCount: 3,
                    readyDocumentCount: 2,
                    searchableChunkCount: 10,
                },
            ]);

            const result = await service.getAvailability(USER_ID);

            expect(result).toEqual({
                documentCount: 3,
                readyDocumentCount: 2,
                searchableChunkCount: 10,
            });

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

            expect(prisma.$queryRaw.mock.calls[0]).toContain(USER_ID);
        });

        it('returns zero values when no availability row exists', async () => {
            prisma.$queryRaw.mockResolvedValue([]);

            const result = await service.getAvailability(USER_ID);

            expect(result).toEqual({
                documentCount: 0,
                readyDocumentCount: 0,
                searchableChunkCount: 0,
            });
        });
    });

    describe('findRelevantChunks', () => {
        it('passes userId to the embeddings service', async () => {
            prisma.$queryRaw.mockResolvedValue([]);

            await service.findRelevantChunks(
                USER_ID,
                '  Which tools are mentioned?  ',
            );

            expect(embeddingsService.createOne).toHaveBeenCalledWith(
                USER_ID,
                'Which tools are mentioned?',
            );
        });

        it('filters candidates by similarity and returns no more than five results', async () => {
            const relevantCandidates = Array.from(
                {
                    length: 6,
                },
                (_, index) =>
                    createSearchResult({
                        chunkId: `chunk-${index + 1}`,
                        similarity: 0.9 - index * 0.05,
                    }),
            );

            const irrelevantCandidate = createSearchResult({
                chunkId: 'irrelevant-chunk',
                similarity: 0.19,
            });

            prisma.$queryRaw.mockResolvedValue([
                ...relevantCandidates,
                irrelevantCandidate,
            ]);

            const result = await service.findRelevantChunks(
                USER_ID,
                'Frontend experience',
            );

            expect(result).toHaveLength(5);

            expect(
                result.some((chunk) => chunk.chunkId === 'irrelevant-chunk'),
            ).toBe(false);
        });

        it('normalizes similarity values', async () => {
            prisma.$queryRaw.mockResolvedValue([
                createSearchResult({
                    similarity: 0.87654321,
                }),
            ]);

            const result = await service.findRelevantChunks(
                USER_ID,
                'Frontend experience',
            );

            expect(result[0]?.similarity).toBe(0.8765);
        });
    });

    describe('search', () => {
        it('does not generate an embedding when there is no searchable content', async () => {
            prisma.$queryRaw.mockResolvedValue([
                {
                    documentCount: 1,
                    readyDocumentCount: 1,
                    searchableChunkCount: 0,
                },
            ]);

            const result = await service.search(USER_ID, '  Test question  ');

            expect(result).toEqual({
                query: 'Test question',
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            });

            expect(embeddingsService.createOne).not.toHaveBeenCalled();

            expect(detectQueryIntentMock).not.toHaveBeenCalled();
        });
    });

    describe('retrieveForChat: factual', () => {
        it('returns chunks only from the best-ranked document', async () => {
            const resumeChunkOne = createSearchResult({
                chunkId: 'resume-chunk-1',
                documentId: 'resume',
                documentName: 'Resume.pdf',
                similarity: 0.9,
            });

            const resumeChunkTwo = createSearchResult({
                chunkId: 'resume-chunk-2',
                documentId: 'resume',
                documentName: 'Resume.pdf',
                chunkIndex: 1,
                similarity: 0.8,
            });

            const invoiceChunk = createSearchResult({
                chunkId: 'invoice-chunk-1',
                documentId: 'invoice',
                documentName: 'Invoice.pdf',
                similarity: 0.55,
            });

            prisma.$queryRaw.mockResolvedValue([
                invoiceChunk,
                resumeChunkTwo,
                resumeChunkOne,
            ]);

            const result = await service.retrieveForChat(
                USER_ID,
                '  Which skills are mentioned?  ',
            );

            expect(detectQueryIntentMock).toHaveBeenCalledWith(
                'Which skills are mentioned?',
            );

            expect(embeddingsService.createOne).toHaveBeenCalledWith(
                USER_ID,
                'Which skills are mentioned?',
            );

            expect(result.status).toBe('FOUND');

            expect(
                result.results.map((chunk: SearchResult) => chunk.documentId),
            ).toEqual(['resume', 'resume']);

            expect(
                result.results.map((chunk: SearchResult) => chunk.chunkId),
            ).toEqual(['resume-chunk-1', 'resume-chunk-2']);
        });

        it('returns NO_RELEVANT_CONTEXT when similarity is too low', async () => {
            prisma.$queryRaw.mockResolvedValue([
                createSearchResult({
                    similarity: 0.19,
                }),

                createSearchResult({
                    chunkId: 'chunk-2',
                    similarity: 0.1,
                }),
            ]);

            const result = await service.retrieveForChat(
                USER_ID,
                'Unrelated question',
            );

            expect(result).toEqual({
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            });
        });

        it('propagates embedding errors', async () => {
            const embeddingError = new Error('Daily budget exceeded');

            embeddingsService.createOne.mockRejectedValue(embeddingError);

            await expect(
                service.retrieveForChat(USER_ID, 'Test question'),
            ).rejects.toBe(embeddingError);

            expect(prisma.$queryRaw).not.toHaveBeenCalled();
        });
    });

    describe('retrieveForChat: comparison', () => {
        it('selects up to three chunks from each of the two best documents', async () => {
            detectQueryIntentMock.mockReturnValue(QueryIntent.COMPARISON);

            const candidates = [
                ...Array.from(
                    {
                        length: 4,
                    },
                    (_, index) =>
                        createSearchResult({
                            chunkId: `resume-${index}`,
                            documentId: 'resume',
                            documentName: 'Resume.pdf',
                            chunkIndex: index,
                            similarity: 0.9 - index * 0.03,
                        }),
                ),

                ...Array.from(
                    {
                        length: 4,
                    },
                    (_, index) =>
                        createSearchResult({
                            chunkId: `invoice-${index}`,
                            documentId: 'invoice',
                            documentName: 'Invoice.pdf',
                            chunkIndex: index,
                            similarity: 0.85 - index * 0.03,
                        }),
                ),
            ];

            prisma.$queryRaw.mockResolvedValue(candidates);

            const result = await service.retrieveForChat(
                USER_ID,
                'Compare the resume and invoice',
            );

            expect(result.status).toBe('FOUND');

            expect(result.results).toHaveLength(6);

            expect(
                result.results.filter((chunk) => chunk.documentId === 'resume'),
            ).toHaveLength(3);

            expect(
                result.results.filter(
                    (chunk) => chunk.documentId === 'invoice',
                ),
            ).toHaveLength(3);
        });
    });

    describe('retrieveForChat: exhaustive', () => {
        it('excludes documents whose score is too far from the best document', async () => {
            detectQueryIntentMock.mockReturnValue(QueryIntent.EXHAUSTIVE);

            prisma.$queryRaw.mockResolvedValue([
                createSearchResult({
                    chunkId: 'best-chunk-1',
                    documentId: 'best',
                    similarity: 0.9,
                }),

                createSearchResult({
                    chunkId: 'best-chunk-2',
                    documentId: 'best',
                    chunkIndex: 1,
                    similarity: 0.85,
                }),

                createSearchResult({
                    chunkId: 'close-chunk-1',
                    documentId: 'close',
                    similarity: 0.8,
                }),

                createSearchResult({
                    chunkId: 'close-chunk-2',
                    documentId: 'close',
                    chunkIndex: 1,
                    similarity: 0.75,
                }),

                createSearchResult({
                    chunkId: 'distant-chunk',
                    documentId: 'distant',
                    similarity: 0.5,
                }),
            ]);

            const result = await service.retrieveForChat(
                USER_ID,
                'Tell me everything about the documents',
            );

            expect(result.status).toBe('FOUND');

            expect(
                result.results.some((chunk) => chunk.documentId === 'best'),
            ).toBe(true);

            expect(
                result.results.some((chunk) => chunk.documentId === 'close'),
            ).toBe(true);

            expect(
                result.results.some((chunk) => chunk.documentId === 'distant'),
            ).toBe(false);
        });
    });

    describe('retrieveForChat: single document summary', () => {
        beforeEach(() => {
            detectQueryIntentMock.mockReturnValue(QueryIntent.SUMMARY_SINGLE);
        });

        it('returns NO_RELEVANT_CONTEXT when there are no ready documents', async () => {
            prisma.document.findMany.mockResolvedValue([]);

            const result = await service.retrieveForChat(
                USER_ID,
                'Summarize this document',
            );

            expect(result).toEqual({
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            });

            expect(embeddingsService.createOne).not.toHaveBeenCalled();
        });

        it('requires document selection when multiple documents exist and none is named', async () => {
            prisma.document.findMany.mockResolvedValue([
                {
                    id: 'resume',
                    name: 'Resume.pdf',
                    chunkCount: 3,
                },

                {
                    id: 'invoice',
                    name: 'Invoice.pdf',
                    chunkCount: 2,
                },
            ]);

            const result = await service.retrieveForChat(
                USER_ID,
                'Summarize this document',
            );

            expect(result).toEqual({
                status: 'DOCUMENT_SELECTION_REQUIRED',
                results: [],
            });

            expect(embeddingsService.createOne).not.toHaveBeenCalled();

            expect(prisma.$queryRaw).not.toHaveBeenCalled();
        });

        it('summarizes the only ready document', async () => {
            prisma.document.findMany.mockResolvedValue([
                {
                    id: 'resume',
                    name: 'Resume.pdf',
                    chunkCount: 2,
                },
            ]);

            const firstChunk = createSearchResult({
                chunkId: 'resume-chunk-1',
                documentId: 'resume',
                documentName: 'Resume.pdf',
                chunkIndex: 0,
            });

            const secondChunk = createSearchResult({
                chunkId: 'resume-chunk-2',
                documentId: 'resume',
                documentName: 'Resume.pdf',
                chunkIndex: 1,
            });

            prisma.$queryRaw.mockResolvedValue([firstChunk, secondChunk]);

            const result = await service.retrieveForChat(
                USER_ID,
                'Summarize this document',
            );

            expect(result).toEqual({
                status: 'FOUND',
                results: [firstChunk, secondChunk],
            });

            expect(embeddingsService.createOne).toHaveBeenCalledWith(
                USER_ID,
                'Summarize this document',
            );
        });

        it('selects a named document from multiple documents', async () => {
            prisma.document.findMany.mockResolvedValue([
                {
                    id: 'resume',
                    name: 'Resume.pdf',
                    chunkCount: 3,
                },

                {
                    id: 'invoice',
                    name: 'Invoice.pdf',
                    chunkCount: 2,
                },
            ]);

            const resumeChunk = createSearchResult({
                documentId: 'resume',
                documentName: 'Resume.pdf',
            });

            prisma.$queryRaw.mockResolvedValue([resumeChunk]);

            const result = await service.retrieveForChat(
                USER_ID,
                'Summarize Resume.pdf',
            );

            expect(result).toEqual({
                status: 'FOUND',
                results: [resumeChunk],
            });
        });
    });

    describe('retrieveForChat: all documents summary', () => {
        beforeEach(() => {
            detectQueryIntentMock.mockReturnValue(QueryIntent.SUMMARY_ALL);
        });

        it('requires document selection when more than five documents exist', async () => {
            prisma.document.findMany.mockResolvedValue(
                Array.from(
                    {
                        length: 6,
                    },
                    (_, index) => ({
                        id: `document-${index}`,
                        name: `Document ${index}.pdf`,
                        chunkCount: 1,
                    }),
                ),
            );

            const result = await service.retrieveForChat(
                USER_ID,
                'Summarize all uploaded documents',
            );

            expect(result).toEqual({
                status: 'DOCUMENT_SELECTION_REQUIRED',
                results: [],
            });

            expect(embeddingsService.createOne).not.toHaveBeenCalled();
        });

        it('returns chunks from every ready document', async () => {
            prisma.document.findMany.mockResolvedValue([
                {
                    id: 'resume',
                    name: 'Resume.pdf',
                    chunkCount: 2,
                },

                {
                    id: 'invoice',
                    name: 'Invoice.pdf',
                    chunkCount: 2,
                },
            ]);

            const resumeChunk = createSearchResult({
                chunkId: 'resume-chunk',
                documentId: 'resume',
                documentName: 'Resume.pdf',
            });

            const invoiceChunk = createSearchResult({
                chunkId: 'invoice-chunk',
                documentId: 'invoice',
                documentName: 'Invoice.pdf',
            });

            prisma.$queryRaw
                .mockResolvedValueOnce([resumeChunk])
                .mockResolvedValueOnce([invoiceChunk]);

            const result = await service.retrieveForChat(
                USER_ID,
                'Summarize all uploaded documents',
            );

            expect(result).toEqual({
                status: 'FOUND',
                results: [resumeChunk, invoiceChunk],
            });

            expect(embeddingsService.createOne).toHaveBeenCalledTimes(1);

            expect(embeddingsService.createOne).toHaveBeenCalledWith(
                USER_ID,
                'Summarize all uploaded documents',
            );

            expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
        });
    });
});
