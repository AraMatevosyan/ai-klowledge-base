import {
    BadGatewayException,
    Logger,
    UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AiBudgetService } from './ai-budget.service';
import type { OpenAiClientService } from './openai-client.service';
import { DailyAiBudgetExceededException } from './daily-ai-budget-exceeded.exception';
import {
    EMBEDDING_DIMENSIONS,
    EmbeddingsService,
} from './embeddings.service';

const createEmbedding = (
    value: number,
): number[] =>
    Array.from(
        {
            length: EMBEDDING_DIMENSIONS,
        },
        () => value,
    );

const reservation = {
    userId: 'user-1',

    usageDate: new Date(
        '2026-08-27T00:00:00.000Z',
    ),

    amountNanoUsd: 1_000n,
};

describe('EmbeddingsService', () => {
    let service: EmbeddingsService;

    const embeddingsCreate =
        jest.fn();

    const openAiClient = {
        getClient: jest.fn(),
    };

    const aiBudgetService = {
        reserveForEmbedding:
            jest.fn(),

        settle: jest.fn(),

        release: jest.fn(),
    };

    const openAiClientInstance = {
        embeddings: {
            create: embeddingsCreate,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        jest.spyOn(
            Logger.prototype,
            'error',
        ).mockImplementation(
            () => undefined,
        );

        openAiClient.getClient.mockReturnValue(
            openAiClientInstance,
        );

        aiBudgetService
            .reserveForEmbedding
            .mockResolvedValue(
                reservation,
            );

        aiBudgetService
            .settle
            .mockResolvedValue(
                undefined,
            );

        aiBudgetService
            .release
            .mockResolvedValue(
                undefined,
            );

        const configService = {
            get: jest
                .fn()
                .mockReturnValue(
                    undefined,
                ),
        };

        service =
            new EmbeddingsService(
                configService as unknown as ConfigService,

                openAiClient as unknown as OpenAiClientService,

                aiBudgetService as unknown as AiBudgetService,
            );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns an empty array without calling OpenAI or reserving budget', async () => {
        await expect(
            service.createMany(
                'user-1',
                [],
            ),
        ).resolves.toEqual([]);

        expect(
            openAiClient.getClient,
        ).not.toHaveBeenCalled();

        expect(
            aiBudgetService
                .reserveForEmbedding,
        ).not.toHaveBeenCalled();

        expect(
            embeddingsCreate,
        ).not.toHaveBeenCalled();
    });

    it('rejects empty embedding inputs before reserving budget', async () => {
        await expect(
            service.createMany(
                'user-1',
                [
                    'valid input',
                    '   ',
                ],
            ),
        ).rejects.toBeInstanceOf(
            UnprocessableEntityException,
        );

        expect(
            openAiClient.getClient,
        ).not.toHaveBeenCalled();

        expect(
            aiBudgetService
                .reserveForEmbedding,
        ).not.toHaveBeenCalled();

        expect(
            embeddingsCreate,
        ).not.toHaveBeenCalled();
    });

    it('reserves budget and settles actual embedding token usage', async () => {
        const firstEmbedding =
            createEmbedding(1);

        const secondEmbedding =
            createEmbedding(2);

        embeddingsCreate.mockResolvedValue({
            data: [
                {
                    index: 1,
                    embedding:
                    secondEmbedding,
                },
                {
                    index: 0,
                    embedding:
                    firstEmbedding,
                },
            ],

            usage: {
                prompt_tokens: 25,
                total_tokens: 25,
            },
        });

        const inputs = [
            'first input',
            'second input',
        ];

        const result =
            await service.createMany(
                'user-1',
                inputs,
            );

        expect(result).toEqual([
            firstEmbedding,
            secondEmbedding,
        ]);

        expect(
            aiBudgetService
                .reserveForEmbedding,
        ).toHaveBeenCalledWith(
            'user-1',
            inputs,
        );

        expect(
            embeddingsCreate,
        ).toHaveBeenCalledWith({
            model:
                'text-embedding-3-small',

            input: inputs,

            dimensions:
            EMBEDDING_DIMENSIONS,

            encoding_format:
                'float',
        });

        expect(
            aiBudgetService.settle,
        ).toHaveBeenCalledWith(
            reservation,
            {
                embeddingTokens: 25,
            },
        );

        expect(
            aiBudgetService.release,
        ).not.toHaveBeenCalled();
    });

    it('reserves and settles each OpenAI batch separately', async () => {
        const inputs = Array.from(
            {
                length: 101,
            },
            (_, index) =>
                `input-${index + 1}`,
        );

        const secondReservation = {
            ...reservation,
            amountNanoUsd: 2_000n,
        };

        aiBudgetService
            .reserveForEmbedding
            .mockResolvedValueOnce(
                reservation,
            )
            .mockResolvedValueOnce(
                secondReservation,
            );

        embeddingsCreate.mockImplementation(
            async ({
                       input,
                   }: {
                input: string[];
            }) => ({
                data: input.map(
                    (_, index) => ({
                        index,
                        embedding:
                            createEmbedding(
                                index + 1,
                            ),
                    }),
                ),

                usage: {
                    prompt_tokens:
                    input.length,

                    total_tokens:
                    input.length,
                },
            }),
        );

        const result =
            await service.createMany(
                'user-1',
                inputs,
            );

        expect(result).toHaveLength(
            101,
        );

        expect(
            aiBudgetService
                .reserveForEmbedding,
        ).toHaveBeenCalledTimes(2);

        expect(
            aiBudgetService
                .reserveForEmbedding,
        ).toHaveBeenNthCalledWith(
            1,
            'user-1',
            inputs.slice(0, 100),
        );

        expect(
            aiBudgetService
                .reserveForEmbedding,
        ).toHaveBeenNthCalledWith(
            2,
            'user-1',
            inputs.slice(100),
        );

        expect(
            aiBudgetService.settle,
        ).toHaveBeenNthCalledWith(
            1,
            reservation,
            {
                embeddingTokens: 100,
            },
        );

        expect(
            aiBudgetService.settle,
        ).toHaveBeenNthCalledWith(
            2,
            secondReservation,
            {
                embeddingTokens: 1,
            },
        );
    });

    it('preserves the daily budget exception without calling OpenAI', async () => {
        const budgetError =
            new DailyAiBudgetExceededException(
                new Date(
                    '2026-08-28T00:00:00.000Z',
                ),
            );

        aiBudgetService
            .reserveForEmbedding
            .mockRejectedValue(
                budgetError,
            );

        await expect(
            service.createMany(
                'user-1',
                ['test input'],
            ),
        ).rejects.toBe(
            budgetError,
        );

        expect(
            embeddingsCreate,
        ).not.toHaveBeenCalled();

        expect(
            aiBudgetService.settle,
        ).not.toHaveBeenCalled();

        expect(
            aiBudgetService.release,
        ).not.toHaveBeenCalled();
    });

    it('releases the reservation when the OpenAI request fails', async () => {
        embeddingsCreate.mockRejectedValue(
            new Error(
                'OpenAI is unavailable',
            ),
        );

        await expect(
            service.createMany(
                'user-1',
                ['test input'],
            ),
        ).rejects.toBeInstanceOf(
            BadGatewayException,
        );

        expect(
            aiBudgetService
                .reserveForEmbedding,
        ).toHaveBeenCalledWith(
            'user-1',
            ['test input'],
        );

        expect(
            aiBudgetService.release,
        ).toHaveBeenCalledWith(
            reservation,
        );

        expect(
            aiBudgetService.settle,
        ).not.toHaveBeenCalled();
    });

    it('does not replace the OpenAI error when releasing the reservation fails', async () => {
        embeddingsCreate.mockRejectedValue(
            new Error(
                'OpenAI is unavailable',
            ),
        );

        aiBudgetService
            .release
            .mockRejectedValue(
                new Error(
                    'Database is unavailable',
                ),
            );

        await expect(
            service.createMany(
                'user-1',
                ['test input'],
            ),
        ).rejects.toBeInstanceOf(
            BadGatewayException,
        );

        expect(
            aiBudgetService.release,
        ).toHaveBeenCalledWith(
            reservation,
        );

        expect(
            aiBudgetService.settle,
        ).not.toHaveBeenCalled();
    });

    it('settles actual usage when OpenAI returns an invalid response', async () => {
        embeddingsCreate.mockResolvedValue({
            data: [],

            usage: {
                prompt_tokens: 10,
                total_tokens: 10,
            },
        });

        await expect(
            service.createMany(
                'user-1',
                ['test input'],
            ),
        ).rejects.toBeInstanceOf(
            BadGatewayException,
        );

        /*
         * OpenAI processed the request and charged
         * for it, so the actual usage must still
         * be recorded even if its response is invalid.
         */
        expect(
            aiBudgetService.settle,
        ).toHaveBeenCalledWith(
            reservation,
            {
                embeddingTokens: 10,
            },
        );

        expect(
            aiBudgetService.release,
        ).not.toHaveBeenCalled();
    });
});
