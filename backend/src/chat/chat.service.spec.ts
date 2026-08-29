import { Test, type TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { AnswerGenerationService } from '../ai/answer-generation.service';

describe('ChatService', () => {
    let service: ChatService;

    const prisma = {
        message: {
            create: jest.fn(),
            findMany: jest.fn(),
            deleteMany: jest.fn(),
        },

        $transaction: jest.fn(),
    };

    const searchService = {
        getAvailability: jest.fn(),
        retrieveForChat: jest.fn(),
    };

    const answerGenerationService = {
        generateAnswer: jest.fn(),
        streamAnswer: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatService,

                {
                    provide: PrismaService,
                    useValue: prisma,
                },

                {
                    provide: SearchService,
                    useValue: searchService,
                },

                {
                    provide: AnswerGenerationService,
                    useValue: answerGenerationService,
                },
            ],
        }).compile();

        service = module.get(ChatService);

        prisma.message.create.mockReturnValue({});

        prisma.$transaction.mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    function mockSearchableDocuments() {
        searchService.getAvailability.mockResolvedValue({
            documentCount: 2,
            readyDocumentCount: 2,
            searchableChunkCount: 5,
        });
    }

    it('returns NO_DOCUMENTS and saves the exchange', async () => {
        searchService.getAvailability.mockResolvedValue({
            documentCount: 0,
            readyDocumentCount: 0,
            searchableChunkCount: 0,
        });

        const result = await service.askQuestion('user-1', '  What is this?  ');

        expect(result).toEqual({
            status: 'NO_DOCUMENTS',
            question: 'What is this?',
            answer: 'Upload at least one document before asking questions.',
            sources: [],
        });

        expect(searchService.retrieveForChat).not.toHaveBeenCalled();

        expect(answerGenerationService.generateAnswer).not.toHaveBeenCalled();

        expect(prisma.message.create).toHaveBeenCalledTimes(2);

        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it.each([
        {
            availability: {
                documentCount: 2,
                readyDocumentCount: 0,
                searchableChunkCount: 0,
            },

            expectedStatus: 'DOCUMENTS_NOT_READY',

            expectedAnswer:
                'Your documents are still processing or failed to process.',
        },

        {
            availability: {
                documentCount: 2,
                readyDocumentCount: 1,
                searchableChunkCount: 0,
            },

            expectedStatus: 'NO_SEARCHABLE_CONTENT',

            expectedAnswer:
                'No searchable content is available in the uploaded documents.',
        },
    ])(
        'returns $expectedStatus for unavailable content',
        async ({ availability, expectedStatus, expectedAnswer }) => {
            searchService.getAvailability.mockResolvedValue(availability);

            const result = await service.askQuestion('user-1', 'Question');

            expect(result).toEqual({
                status: expectedStatus,
                question: 'Question',
                answer: expectedAnswer,
                sources: [],
            });

            expect(searchService.retrieveForChat).not.toHaveBeenCalled();

            expect(prisma.message.create).toHaveBeenCalledTimes(2);
        },
    );

    it.each([
        {
            retrievalStatus: 'DOCUMENT_SELECTION_REQUIRED',

            expectedStatus: 'DOCUMENT_SELECTION_REQUIRED',

            expectedAnswer:
                'Multiple documents are available. Please specify which document you want to summarize.',
        },

        {
            retrievalStatus: 'NO_RELEVANT_CONTEXT',

            expectedStatus: 'NO_RELEVANT_CONTEXT',

            expectedAnswer:
                "I couldn't find enough information in the uploaded documents.",
        },
    ])(
        'handles retrieval status $retrievalStatus',
        async ({ retrievalStatus, expectedStatus, expectedAnswer }) => {
            mockSearchableDocuments();

            searchService.retrieveForChat.mockResolvedValue({
                status: retrievalStatus,
                results: [],
            });

            const result = await service.askQuestion('user-1', 'Question');

            expect(result).toEqual({
                status: expectedStatus,
                question: 'Question',
                answer: expectedAnswer,
                sources: [],
            });

            expect(
                answerGenerationService.generateAnswer,
            ).not.toHaveBeenCalled();

            expect(prisma.message.create).toHaveBeenCalledTimes(2);
        },
    );

    it('generates an answer and keeps only cited sanitized sources', async () => {
        mockSearchableDocuments();

        searchService.retrieveForChat.mockResolvedValue({
            status: 'RESULTS',

            results: [
                {
                    documentId: 'document-1',
                    documentName: 'invoice.pdf',
                    pageNumber: 1,
                    content: 'Invoice total: 700 EUR.',
                },

                {
                    documentId: 'document-2',
                    documentName: 'resume.pdf',
                    pageNumber: 1,
                    content:
                        'developer@example.com\nUses React and TypeScript.',
                },
            ],
        });

        answerGenerationService.generateAnswer.mockResolvedValue(
            'The resume mentions React and TypeScript [2].',
        );

        const result = await service.askQuestion(
            'user-1',
            '  Which technologies are mentioned?  ',
        );

        expect(searchService.retrieveForChat).toHaveBeenCalledWith(
            'user-1',
            'Which technologies are mentioned?',
        );

        expect(answerGenerationService.generateAnswer).toHaveBeenCalledWith(
            'user-1',
            'Which technologies are mentioned?',
            [
                {
                    documentId: 'document-1',
                    documentName: 'invoice.pdf',
                    pageNumber: 1,
                    content: 'Invoice total: 700 EUR.',
                },
                {
                    documentId: 'document-2',
                    documentName: 'resume.pdf',
                    pageNumber: 1,
                    content:
                        'developer@example.com\nUses React and TypeScript.',
                },
            ],
        );

        expect(result.status).toBe('ANSWERED');

        expect(result.sources).toEqual([
            {
                sourceNumber: 2,
                documentId: 'document-2',
                documentName: 'resume.pdf',
                pageNumber: 1,
                excerpt: '[email redacted]\nUses React and TypeScript.',
            },
        ]);

        expect(result.sources[0].excerpt).not.toContain(
            'developer@example.com',
        );

        expect(prisma.message.create).toHaveBeenNthCalledWith(2, {
            data: {
                userId: 'user-1',
                role: 'ASSISTANT',
                content: 'The resume mentions React and TypeScript [2].',
                sources: result.sources,
                createdAt: expect.any(Date) as unknown,
            },
        });
    });

    it('streams an answer and calls onDelta for every delta', async () => {
        mockSearchableDocuments();

        searchService.retrieveForChat.mockResolvedValue({
            status: 'RESULTS',

            results: [
                {
                    documentId: 'document-1',
                    documentName: 'resume.pdf',
                    pageNumber: 1,
                    content: 'React and TypeScript.',
                },
            ],
        });

        answerGenerationService.streamAnswer.mockImplementation(
            async function* () {
                await Promise.resolve();

                yield 'React ';
                yield 'and TypeScript ';
                yield 'are mentioned [1].';
            },
        );

        const onDelta = jest.fn();

        const result = await service.askQuestion(
            'user-1',
            'Which technologies?',
            onDelta,
        );

        expect(onDelta).toHaveBeenNthCalledWith(1, 'React ');

        expect(onDelta).toHaveBeenNthCalledWith(2, 'and TypeScript ');

        expect(onDelta).toHaveBeenNthCalledWith(3, 'are mentioned [1].');

        expect(result).toEqual({
            status: 'ANSWERED',
            question: 'Which technologies?',
            answer: 'React and TypeScript are mentioned [1].',

            sources: [
                {
                    sourceNumber: 1,
                    documentId: 'document-1',
                    documentName: 'resume.pdf',
                    pageNumber: 1,
                    excerpt: 'React and TypeScript.',
                },
            ],
        });

        expect(answerGenerationService.generateAnswer).not.toHaveBeenCalled();
    });

    it('returns messages in frontend format', async () => {
        const createdAt = new Date('2026-08-24T10:00:00.000Z');

        prisma.message.findMany.mockResolvedValue([
            {
                id: 'message-1',
                role: 'USER',
                content: 'Question',
                sources: null,
                createdAt,
            },

            {
                id: 'message-2',
                role: 'ASSISTANT',
                content: 'Answer [1]',
                sources: [
                    {
                        sourceNumber: 1,
                    },
                ],
                createdAt,
            },
        ]);

        const result = await service.getMessages('user-1');

        expect(prisma.message.findMany).toHaveBeenCalledWith({
            where: {
                userId: 'user-1',
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        expect(result.messages).toEqual([
            {
                id: 'message-1',
                role: 'user',
                content: 'Question',
                sources: [],
                createdAt,
            },

            {
                id: 'message-2',
                role: 'assistant',
                content: 'Answer [1]',
                sources: [
                    {
                        sourceNumber: 1,
                    },
                ],
                createdAt,
            },
        ]);
    });

    it('clears only the current user messages', async () => {
        prisma.message.deleteMany.mockResolvedValue({
            count: 4,
        });

        const result = await service.clearMessages('user-1');

        expect(prisma.message.deleteMany).toHaveBeenCalledWith({
            where: {
                userId: 'user-1',
            },
        });

        expect(result).toEqual({
            deletedCount: 4,
        });
    });
});
