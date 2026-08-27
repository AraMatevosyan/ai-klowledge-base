import type { AiBudgetService } from './ai-budget.service';
import {
    AnswerGenerationService,
    type AnswerContextChunk,
} from './answer-generation.service';
import { DailyAiBudgetExceededException } from './daily-ai-budget-exceeded.exception';
import type { OpenAiClientService } from './openai-client.service';

const reservation = {
    userId: 'user-1',

    usageDate: new Date('2026-08-27T00:00:00.000Z'),

    amountNanoUsd: 1_000_000n,
};

const chunks: AnswerContextChunk[] = [
    {
        documentId: 'document-1',
        documentName: 'resume.pdf',
        pageNumber: 1,
        content: 'Ara is a frontend engineer.',
    },
];

describe('AnswerGenerationService', () => {
    let service: AnswerGenerationService;

    const responsesCreate = jest.fn();

    const openAiClientService = {
        getClient: jest.fn(),
    };

    const aiBudgetService = {
        reserveForChat: jest.fn(),
        settle: jest.fn(),
        release: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        openAiClientService.getClient.mockReturnValue({
            responses: {
                create: responsesCreate,
            },
        });

        aiBudgetService.reserveForChat.mockResolvedValue(reservation);

        aiBudgetService.settle.mockResolvedValue(undefined);

        aiBudgetService.release.mockResolvedValue(undefined);

        service = new AnswerGenerationService(
            openAiClientService as unknown as OpenAiClientService,

            aiBudgetService as unknown as AiBudgetService,
        );
    });

    it('preserves the daily budget error for a regular answer', async () => {
        const budgetError = new DailyAiBudgetExceededException(
            new Date('2026-08-28T00:00:00.000Z'),
        );

        aiBudgetService.reserveForChat.mockRejectedValue(budgetError);

        await expect(
            service.generateAnswer('user-1', 'What does Ara do?', chunks),
        ).rejects.toBe(budgetError);

        expect(aiBudgetService.reserveForChat).toHaveBeenCalledWith(
            'user-1',
            expect.stringContaining('GROUNDING RULES'),
            expect.stringContaining('What does Ara do?'),
            1_000,
        );

        expect(responsesCreate).not.toHaveBeenCalled();

        expect(aiBudgetService.settle).not.toHaveBeenCalled();

        expect(aiBudgetService.release).not.toHaveBeenCalled();
    });

    it('preserves the daily budget error for a streaming answer', async () => {
        const budgetError = new DailyAiBudgetExceededException(
            new Date('2026-08-28T00:00:00.000Z'),
        );

        aiBudgetService.reserveForChat.mockRejectedValue(budgetError);

        const stream = service.streamAnswer(
            'user-1',
            'What does Ara do?',
            chunks,
        );

        /*
         * Async generator code starts only
         * after next() is called.
         */
        await expect(stream.next()).rejects.toBe(budgetError);

        expect(aiBudgetService.reserveForChat).toHaveBeenCalledWith(
            'user-1',
            expect.stringContaining('GROUNDING RULES'),
            expect.stringContaining('What does Ara do?'),
            1_000,
        );

        expect(responsesCreate).not.toHaveBeenCalled();

        expect(aiBudgetService.settle).not.toHaveBeenCalled();

        expect(aiBudgetService.release).not.toHaveBeenCalled();
    });

    it('settles actual token usage for a regular answer', async () => {
        responsesCreate.mockResolvedValue({
            status: 'completed',

            output_text: ' Ara is a frontend engineer. ',

            usage: {
                input_tokens: 120,
                output_tokens: 30,

                input_tokens_details: {
                    cached_tokens: 40,
                },
            },
        });

        const answer = await service.generateAnswer(
            'user-1',
            'What does Ara do?',
            chunks,
        );

        expect(answer).toBe('Ara is a frontend engineer.');

        expect(aiBudgetService.settle).toHaveBeenCalledWith(reservation, {
            chatInputTokens: 120,
            chatCachedInputTokens: 40,
            chatOutputTokens: 30,
        });

        expect(aiBudgetService.release).not.toHaveBeenCalled();
    });

    it('settles actual token usage for a streaming answer', async () => {
        async function* createStream() {
            yield {
                type: 'response.output_text.delta',
                delta: 'Ara is ',
            };

            yield {
                type: 'response.output_text.delta',
                delta: 'a frontend engineer.',
            };

            yield {
                type: 'response.completed',

                response: {
                    usage: {
                        input_tokens: 150,
                        output_tokens: 35,

                        input_tokens_details: {
                            cached_tokens: 50,
                        },
                    },
                },
            };
        }

        responsesCreate.mockResolvedValue(createStream());

        const deltas: string[] = [];

        for await (const delta of service.streamAnswer(
            'user-1',
            'What does Ara do?',
            chunks,
        )) {
            deltas.push(delta);
        }

        expect(deltas).toEqual(['Ara is ', 'a frontend engineer.']);

        expect(aiBudgetService.settle).toHaveBeenCalledWith(reservation, {
            chatInputTokens: 150,
            chatCachedInputTokens: 50,
            chatOutputTokens: 35,
        });

        expect(aiBudgetService.release).not.toHaveBeenCalled();
    });
});
