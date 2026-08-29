import { HttpStatus, InternalServerErrorException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '../prisma/prisma.service';
import { AiBudgetService } from './ai-budget.service';
import { DailyAiBudgetExceededException } from './daily-ai-budget-exceeded.exception';

const NOW = new Date('2026-08-27T18:30:00.000Z');

const USAGE_DATE = new Date('2026-08-27T00:00:00.000Z');

const RESET_AT = '2026-08-28T00:00:00.000Z';

const DEFAULT_CONFIG: Record<string, number> = {
    DAILY_AI_BUDGET_USD: 1,

    OPENAI_CHAT_INPUT_USD_PER_MILLION_TOKENS: 1,

    OPENAI_CHAT_CACHED_INPUT_USD_PER_MILLION_TOKENS: 0.5,

    OPENAI_CHAT_OUTPUT_USD_PER_MILLION_TOKENS: 2,

    OPENAI_EMBEDDING_USD_PER_MILLION_TOKENS: 0.1,
};

describe('AiBudgetService', () => {
    const prisma = {
        $queryRaw: jest.fn<Promise<unknown>, unknown[]>(),
        $executeRaw: jest.fn<Promise<number>, unknown[]>(),
    };

    function createService(
        configOverrides: Record<string, number> = {},
    ): AiBudgetService {
        const config = {
            ...DEFAULT_CONFIG,
            ...configOverrides,
        };

        const configService = {
            getOrThrow: jest.fn((key: string) => {
                const value = config[key];

                if (value === undefined) {
                    throw new Error(`Missing config: ${key}`);
                }

                return value;
            }),
        };

        return new AiBudgetService(
            prisma as unknown as PrismaService,

            configService as unknown as ConfigService,
        );
    }

    beforeEach(() => {
        jest.useFakeTimers();

        jest.setSystemTime(NOW);

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('reserves budget for embeddings', async () => {
        const service = createService();

        prisma.$queryRaw.mockResolvedValue([
            {
                reservedNanoUsd: 1_000n,
            },
        ]);

        const result = await service.reserveForEmbedding('user-1', [
            'hello',
            'world',
        ]);

        expect(result).toEqual({
            userId: 'user-1',
            usageDate: USAGE_DATE,
            amountNanoUsd: 1_000n,
        });

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

        const queryValues = prisma.$queryRaw.mock.calls[0].slice(1);

        expect(queryValues).toEqual([
            'user-1',
            USAGE_DATE,
            1_000n,
            1_000_000_000n,
        ]);
    });

    it('reserves the maximum estimated chat cost', async () => {
        const service = createService();

        prisma.$queryRaw.mockResolvedValue([
            {
                reservedNanoUsd: 1_238_000n,
            },
        ]);

        const result = await service.reserveForChat(
            'user-1',
            'rules',
            'question',
            100,
        );

        /*
         * Input estimate:
         *
         * "rules\nquestion" = 14 bytes
         * 14 + 1024 buffer = 1038 tokens
         *
         * Input:
         * 1038 × 1000 nano USD
         *
         * Output:
         * 100 × 2000 nano USD
         *
         * Total:
         * 1,238,000 nano USD
         */

        expect(result).toEqual({
            userId: 'user-1',
            usageDate: USAGE_DATE,
            amountNanoUsd: 1_238_000n,
        });
    });

    it('rejects a single reservation larger than the daily budget', async () => {
        const service = createService({
            DAILY_AI_BUDGET_USD: 0.0000005,
        });

        await expect(
            service.reserveForEmbedding('user-1', 'hello!'),
        ).rejects.toBeInstanceOf(DailyAiBudgetExceededException);

        expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('rejects a reservation when the accumulated daily limit is exceeded', async () => {
        const service = createService();

        prisma.$queryRaw.mockResolvedValue([]);

        let caughtError: unknown;

        try {
            await service.reserveForEmbedding('user-1', 'hello');
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError).toBeInstanceOf(DailyAiBudgetExceededException);

        const budgetError = caughtError as DailyAiBudgetExceededException;

        expect(budgetError.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

        expect(budgetError.getResponse()).toMatchObject({
            statusCode: HttpStatus.TOO_MANY_REQUESTS,

            code: 'DAILY_AI_BUDGET_EXCEEDED',

            resetAt: RESET_AT,
        });
    });

    it('settles a reservation using actual token usage', async () => {
        const service = createService();

        prisma.$executeRaw.mockResolvedValue(1);

        await service.settle(
            {
                userId: 'user-1',
                usageDate: USAGE_DATE,
                amountNanoUsd: 2_000_000n,
            },
            {
                chatInputTokens: 1_000,

                chatCachedInputTokens: 200,

                chatOutputTokens: 300,

                embeddingTokens: 400,
            },
        );

        /*
         * Regular input:
         * (1000 - 200) × 1000 = 800,000
         *
         * Cached input:
         * 200 × 500 = 100,000
         *
         * Output:
         * 300 × 2000 = 600,000
         *
         * Embeddings:
         * 400 × 100 = 40,000
         *
         * Total:
         * 1,540,000 nano USD
         */

        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);

        const queryValues = prisma.$executeRaw.mock.calls[0].slice(1);

        expect(queryValues).toEqual([
            2_000_000n,
            1_540_000n,
            1_000,
            200,
            300,
            400,
            'user-1',
            USAGE_DATE,
            2_000_000n,
        ]);
    });

    it('throws when a reservation cannot be settled', async () => {
        const service = createService();

        prisma.$executeRaw.mockResolvedValue(0);

        await expect(
            service.settle(
                {
                    userId: 'user-1',
                    usageDate: USAGE_DATE,
                    amountNanoUsd: 1_000n,
                },
                {
                    embeddingTokens: 5,
                },
            ),
        ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('releases an unused reservation', async () => {
        const service = createService();

        prisma.$executeRaw.mockResolvedValue(1);

        await expect(
            service.release({
                userId: 'user-1',
                usageDate: USAGE_DATE,
                amountNanoUsd: 10_000n,
            }),
        ).resolves.toBeUndefined();

        expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);

        const queryValues = prisma.$executeRaw.mock.calls[0].slice(1);

        expect(queryValues).toEqual([10_000n, 'user-1', USAGE_DATE, 10_000n]);
    });
});
