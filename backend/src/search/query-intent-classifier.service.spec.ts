import type { ConfigService } from '@nestjs/config';
import type { AiBudgetService } from '../ai/ai-budget.service';
import { DailyAiBudgetExceededException } from '../ai/daily-ai-budget-exceeded.exception';
import type { OpenAiClientService } from '../ai/openai-client.service';
import { QueryIntent } from './query-intent';
import { QueryIntentClassifierService } from './query-intent-classifier.service';

const USER_ID = 'user-1';

const RESERVATION = {
    userId: USER_ID,
    usageDate: new Date('2026-09-01T00:00:00.000Z'),
    amountNanoUsd: 1_000_000n,
};

describe('QueryIntentClassifierService', () => {
    let service: QueryIntentClassifierService;

    const responsesCreate = jest.fn();

    const openAiClientService = {
        getClient: jest.fn(),
    };

    const aiBudgetService = {
        reserveForChat: jest.fn(),
        settle: jest.fn(),
        release: jest.fn(),
    };

    const configService = {
        get: jest.fn(),
        getOrThrow: jest.fn(),
    };

    beforeEach(() => {
        jest.resetAllMocks();

        openAiClientService.getClient.mockReturnValue({
            responses: {
                create: responsesCreate,
            },
        });

        aiBudgetService.reserveForChat.mockResolvedValue(RESERVATION);
        aiBudgetService.settle.mockResolvedValue(undefined);
        aiBudgetService.release.mockResolvedValue(undefined);

        configService.get.mockReturnValue('gpt-4.1-mini');

        service = new QueryIntentClassifierService(
            openAiClientService as unknown as OpenAiClientService,
            aiBudgetService as unknown as AiBudgetService,
            configService as unknown as ConfigService,
        );
    });

    it('uses pattern detection without spending AI budget', async () => {
        const result = await service.detect(
            USER_ID,
            '  Summarize   all uploaded documents  ',
        );

        expect(result).toEqual({
            intent: QueryIntent.SUMMARY_ALL,
            retrievalQuery: 'Summarize all uploaded documents',
        });

        expect(aiBudgetService.reserveForChat).not.toHaveBeenCalled();
        expect(openAiClientService.getClient).not.toHaveBeenCalled();
        expect(responsesCreate).not.toHaveBeenCalled();
    });

    it('classifies an unknown language and returns an English retrieval query', async () => {
        responsesCreate.mockResolvedValue({
            status: 'completed',
            output_text: JSON.stringify({
                intent: QueryIntent.FACTUAL,
                retrievalQuery:
                    '  How many years of experience are mentioned in the resume?  ',
            }),
            usage: {
                input_tokens: 80,
                output_tokens: 20,
                input_tokens_details: {
                    cached_tokens: 10,
                },
            },
        });

        const query = 'كم عدد سنوات الخبرة المذكورة في السيرة الذاتية؟';

        const result = await service.detect(USER_ID, query);

        expect(result).toEqual({
            intent: QueryIntent.FACTUAL,
            retrievalQuery:
                'How many years of experience are mentioned in the resume?',
        });

        expect(aiBudgetService.reserveForChat).toHaveBeenCalledWith(
            USER_ID,
            expect.stringContaining('retrievalQuery'),
            query,
            256,
        );

        expect(responsesCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'gpt-4.1-mini',
                input: query,
                max_output_tokens: 256,
                store: false,
            }),
        );

        const expectedUsage: Parameters<AiBudgetService['settle']>[1] = {
            chatInputTokens: 80,
            chatCachedInputTokens: 10,
            chatOutputTokens: 20,
        };

        expect(aiBudgetService.settle).toHaveBeenCalledWith(
            RESERVATION,
            expectedUsage,
        );

        expect(aiBudgetService.release).not.toHaveBeenCalled();
    });

    it('preserves a daily budget error', async () => {
        const budgetError = new DailyAiBudgetExceededException(
            new Date('2026-09-02T00:00:00.000Z'),
        );

        aiBudgetService.reserveForChat.mockRejectedValue(budgetError);

        await expect(
            service.detect(
                USER_ID,
                'Bu iki özgeçmiş arasındaki farklar nelerdir?',
            ),
        ).rejects.toBe(budgetError);

        expect(openAiClientService.getClient).not.toHaveBeenCalled();
        expect(responsesCreate).not.toHaveBeenCalled();
        expect(aiBudgetService.settle).not.toHaveBeenCalled();
        expect(aiBudgetService.release).not.toHaveBeenCalled();
    });

    it('releases the reservation and falls back when the AI request fails', async () => {
        responsesCreate.mockRejectedValue(new Error('OpenAI unavailable'));

        const query = 'Bu iki özgeçmiş arasındaki farklar nelerdir?';

        const result = await service.detect(USER_ID, query);

        expect(result).toEqual({
            intent: QueryIntent.FACTUAL,
            retrievalQuery: query,
        });

        expect(aiBudgetService.release).toHaveBeenCalledWith(RESERVATION);
        expect(aiBudgetService.settle).not.toHaveBeenCalled();
    });

    it('settles usage and falls back when the response is incomplete', async () => {
        responsesCreate.mockResolvedValue({
            status: 'incomplete',
            output_text: '',
            usage: {
                input_tokens: 60,
                output_tokens: 5,
                input_tokens_details: {
                    cached_tokens: 4,
                },
            },
        });

        const query = 'Vergleiche die beiden Lebensläufe.';

        const result = await service.detect(USER_ID, query);

        expect(result).toEqual({
            intent: QueryIntent.FACTUAL,
            retrievalQuery: query,
        });

        expect(aiBudgetService.settle).toHaveBeenCalledWith(RESERVATION, {
            chatInputTokens: 60,
            chatCachedInputTokens: 4,
            chatOutputTokens: 5,
        });

        expect(aiBudgetService.release).not.toHaveBeenCalled();
    });

    it('falls back when the structured response is invalid', async () => {
        responsesCreate.mockResolvedValue({
            status: 'completed',
            output_text: JSON.stringify({
                intent: QueryIntent.COMPARISON,
                retrievalQuery: '   ',
            }),
            usage: {
                input_tokens: 50,
                output_tokens: 10,
            },
        });

        const query = 'Vergleiche die beiden Lebensläufe.';

        const result = await service.detect(USER_ID, query);

        expect(result).toEqual({
            intent: QueryIntent.FACTUAL,
            retrievalQuery: query,
        });

        expect(aiBudgetService.settle).toHaveBeenCalledWith(RESERVATION, {
            chatInputTokens: 50,
            chatCachedInputTokens: 0,
            chatOutputTokens: 10,
        });
    });
});
