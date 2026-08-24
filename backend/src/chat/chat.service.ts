import { Injectable } from '@nestjs/common';
import { SearchService } from '../search/search.service';
import {
    AnswerGenerationService,
    type AnswerContextChunk,
} from '../ai/answer-generation.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatAnswerResponse, ChatSource } from './chat.types';
import { sanitizeSourceExcerpt } from './source-excerpt-sanitizer';
import { filterCitedSources } from './citation.utils';

type AnswerDeltaHandler = (delta: string) => void;

@Injectable()
export class ChatService {
    constructor(
        private readonly prisma: PrismaService,

        private readonly searchService: SearchService,

        private readonly answerGenerationService: AnswerGenerationService,
    ) {}

    async askQuestion(
        userId: string,
        question: string,
        onDelta?: AnswerDeltaHandler,
    ): Promise<ChatAnswerResponse> {
        const normalizedQuestion = question.trim();

        const availability = await this.searchService.getAvailability(userId);

        if (availability.documentCount === 0) {
            return this.completeQuestion(userId, {
                status: 'NO_DOCUMENTS',
                question: normalizedQuestion,
                answer: 'Upload at least one document before asking questions.',
                sources: [],
            });
        }

        if (availability.readyDocumentCount === 0) {
            return this.completeQuestion(userId, {
                status: 'DOCUMENTS_NOT_READY',
                question: normalizedQuestion,
                answer: 'Your documents are still processing or failed to process.',
                sources: [],
            });
        }

        if (availability.searchableChunkCount === 0) {
            return this.completeQuestion(userId, {
                status: 'NO_SEARCHABLE_CONTENT',
                question: normalizedQuestion,
                answer: 'No searchable content is available in the uploaded documents.',
                sources: [],
            });
        }

        const retrieval = await this.searchService.retrieveForChat(
            userId,
            normalizedQuestion,
        );

        if (retrieval.status === 'DOCUMENT_SELECTION_REQUIRED') {
            return this.completeQuestion(userId, {
                status: 'DOCUMENT_SELECTION_REQUIRED',
                question: normalizedQuestion,
                answer: 'Multiple documents are available. Please specify which document you want to summarize.',
                sources: [],
            });
        }

        if (retrieval.status === 'NO_RELEVANT_CONTEXT') {
            return this.completeQuestion(userId, {
                status: 'NO_RELEVANT_CONTEXT',
                question: normalizedQuestion,
                answer: "I couldn't find enough information in the uploaded documents.",
                sources: [],
            });
        }

        const relevantChunks = retrieval.results;

        const answerContext: AnswerContextChunk[] = relevantChunks.map(
            (chunk) => ({
                documentId: chunk.documentId,
                documentName: chunk.documentName,
                pageNumber: chunk.pageNumber,
                content: chunk.content,
            }),
        );

        let answer = '';

        if (onDelta) {
            for await (const delta of this.answerGenerationService.streamAnswer(
                normalizedQuestion,
                answerContext,
            )) {
                answer += delta;
                onDelta(delta);
            }
        } else {
            answer = await this.answerGenerationService.generateAnswer(
                normalizedQuestion,
                answerContext,
            );
        }

        const candidateSources: ChatSource[] = relevantChunks.map(
            (chunk, index) => ({
                sourceNumber: index + 1,
                documentId: chunk.documentId,
                documentName: chunk.documentName,
                pageNumber: chunk.pageNumber,
                excerpt: sanitizeSourceExcerpt(chunk.content),
            }),
        );

        const sources = filterCitedSources(answer, candidateSources);

        return this.completeQuestion(userId, {
            status: 'ANSWERED',
            question: normalizedQuestion,
            answer,
            sources,
        });
    }

    async getMessages(userId: string) {
        const messages = await this.prisma.message.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: 'asc',
            },
        });

        return {
            messages: messages.map((message) => ({
                id: message.id,

                role: message.role === 'USER' ? 'user' : 'assistant',

                content: message.content,

                sources: message.sources ?? [],

                createdAt: message.createdAt,
            })),
        };
    }

    async clearMessages(userId: string): Promise<{ deletedCount: number }> {
        const result = await this.prisma.message.deleteMany({
            where: {
                userId,
            },
        });

        return {
            deletedCount: result.count,
        };
    }

    private async completeQuestion(
        userId: string,
        response: ChatAnswerResponse,
    ): Promise<ChatAnswerResponse> {
        await this.saveExchange(
            userId,
            response.question,
            response.answer,
            response.sources,
        );

        return response;
    }

    private async saveExchange(
        userId: string,
        question: string,
        answer: string,
        sources: ChatSource[],
    ): Promise<void> {
        const createdAt = new Date();

        const serializedSources = sources.map((source) => ({
            sourceNumber: source.sourceNumber,
            documentId: source.documentId,
            documentName: source.documentName,
            pageNumber: source.pageNumber,
            excerpt: source.excerpt,
        }));

        await this.prisma.$transaction([
            this.prisma.message.create({
                data: {
                    userId,
                    role: 'USER',
                    content: question,
                    createdAt,
                },
            }),

            this.prisma.message.create({
                data: {
                    userId,
                    role: 'ASSISTANT',
                    content: answer,
                    sources: serializedSources,
                    createdAt: new Date(createdAt.getTime() + 1),
                },
            }),
        ]);
    }
}
