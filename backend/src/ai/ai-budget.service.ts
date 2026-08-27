import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import {
    ConfigService,
} from '@nestjs/config';

import {
    PrismaService,
} from '../prisma/prisma.service';
import {
    AiBudgetReservation,
    AiTokenUsage,
} from './ai-budget.types';
import {
    DailyAiBudgetExceededException,
} from './daily-ai-budget-exceeded.exception';

const NANO_USD_PER_USD =
    1_000_000_000;

const TOKENS_PER_MILLION =
    1_000_000;

const CHAT_INPUT_TOKEN_BUFFER =
    1_024;

@Injectable()
export class AiBudgetService {
    private readonly logger =
        new Logger(AiBudgetService.name);

    private readonly dailyBudgetNanoUsd:
        bigint;

    private readonly chatInputNanoUsdPerToken:
        number;

    private readonly chatCachedInputNanoUsdPerToken:
        number;

    private readonly chatOutputNanoUsdPerToken:
        number;

    private readonly embeddingNanoUsdPerToken:
        number;

    constructor(
        private readonly prisma:
        PrismaService,

        configService:
        ConfigService,
    ) {
        this.dailyBudgetNanoUsd =
            this.usdToNanoUsd(
                configService.getOrThrow<number>(
                    'DAILY_AI_BUDGET_USD',
                ),
            );

        this.chatInputNanoUsdPerToken =
            this.pricePerMillionToNanoUsdPerToken(
                configService.getOrThrow<number>(
                    'OPENAI_CHAT_INPUT_USD_PER_MILLION_TOKENS',
                ),
            );

        this.chatCachedInputNanoUsdPerToken =
            this.pricePerMillionToNanoUsdPerToken(
                configService.getOrThrow<number>(
                    'OPENAI_CHAT_CACHED_INPUT_USD_PER_MILLION_TOKENS',
                ),
            );

        this.chatOutputNanoUsdPerToken =
            this.pricePerMillionToNanoUsdPerToken(
                configService.getOrThrow<number>(
                    'OPENAI_CHAT_OUTPUT_USD_PER_MILLION_TOKENS',
                ),
            );

        this.embeddingNanoUsdPerToken =
            this.pricePerMillionToNanoUsdPerToken(
                configService.getOrThrow<number>(
                    'OPENAI_EMBEDDING_USD_PER_MILLION_TOKENS',
                ),
            );
    }

    reserveForEmbedding(
        userId: string,
        input: string | string[],
    ): Promise<AiBudgetReservation> {
        const inputs =
            Array.isArray(input)
                ? input
                : [input];

        const maximumInputTokens =
            inputs.reduce(
                (total, value) =>
                    total +
                    Buffer.byteLength(
                        value,
                        'utf8',
                    ),
                0,
            );

        const amountNanoUsd =
            BigInt(
                Math.ceil(
                    maximumInputTokens *
                    this
                        .embeddingNanoUsdPerToken,
                ),
            );

        return this.reserve(
            userId,
            amountNanoUsd,
        );
    }

    reserveForChat(
        userId: string,
        instructions: string,
        input: string,
        maxOutputTokens: number,
    ): Promise<AiBudgetReservation> {
        const maximumInputTokens =
            Buffer.byteLength(
                `${instructions}\n${input}`,
                'utf8',
            ) +
            CHAT_INPUT_TOKEN_BUFFER;

        const amountNanoUsd =
            BigInt(
                Math.ceil(
                    maximumInputTokens *
                    this
                        .chatInputNanoUsdPerToken +
                    maxOutputTokens *
                    this
                        .chatOutputNanoUsdPerToken,
                ),
            );

        return this.reserve(
            userId,
            amountNanoUsd,
        );
    }

    async settle(
        reservation: AiBudgetReservation,
        usage: AiTokenUsage,
    ): Promise<void> {
        const normalizedUsage =
            this.normalizeUsage(usage);

        const actualCostNanoUsd =
            this.calculateCostNanoUsd(
                normalizedUsage,
            );

        if (
            actualCostNanoUsd >
            reservation.amountNanoUsd
        ) {
            this.logger.warn(
                `Actual AI cost exceeded reservation for user ${reservation.userId}`,
            );
        }

        const updatedRows =
            await this.prisma.$executeRaw`
                UPDATE "ai_daily_usage"
                SET
                    "reserved_nano_usd" =
                        "reserved_nano_usd" -
                        ${reservation.amountNanoUsd},

                    "spent_nano_usd" =
                        "spent_nano_usd" +
                        ${actualCostNanoUsd},

                    "chat_input_tokens" =
                        "chat_input_tokens" +
                        ${normalizedUsage.chatInputTokens},

                    "chat_cached_input_tokens" =
                        "chat_cached_input_tokens" +
                        ${normalizedUsage.chatCachedInputTokens},

                    "chat_output_tokens" =
                        "chat_output_tokens" +
                        ${normalizedUsage.chatOutputTokens},

                    "embedding_tokens" =
                        "embedding_tokens" +
                        ${normalizedUsage.embeddingTokens},

                    "updated_at" =
                        CURRENT_TIMESTAMP

                WHERE
                    "user_id" =
                        ${reservation.userId}

                    AND "usage_date" =
                        ${reservation.usageDate}::date

                    AND "reserved_nano_usd" >=
                        ${reservation.amountNanoUsd}
            `;

        if (updatedRows !== 1) {
            throw new InternalServerErrorException(
                'Unable to record AI usage.',
            );
        }
    }

    async release(
        reservation: AiBudgetReservation,
    ): Promise<void> {
        const updatedRows =
            await this.prisma.$executeRaw`
                UPDATE "ai_daily_usage"
                SET
                    "reserved_nano_usd" =
                        "reserved_nano_usd" -
                        ${reservation.amountNanoUsd},

                    "updated_at" =
                        CURRENT_TIMESTAMP

                WHERE
                    "user_id" =
                        ${reservation.userId}

                    AND "usage_date" =
                        ${reservation.usageDate}::date

                    AND "reserved_nano_usd" >=
                        ${reservation.amountNanoUsd}
            `;

        if (updatedRows !== 1) {
            this.logger.warn(
                `Unable to release AI budget reservation for user ${reservation.userId}`,
            );
        }
    }

    private async reserve(
        userId: string,
        amountNanoUsd: bigint,
    ): Promise<AiBudgetReservation> {
        const usageDate =
            this.getCurrentUtcDate();

        if (
            amountNanoUsd >
            this.dailyBudgetNanoUsd
        ) {
            throw new DailyAiBudgetExceededException(
                this.getNextUtcDate(
                    usageDate,
                ),
            );
        }

        const rows =
            await this.prisma.$queryRaw<
                Array<{
                    reservedNanoUsd:
                        bigint;
                }>
            >`
                INSERT INTO "ai_daily_usage" (
                    "user_id",
                    "usage_date",
                    "spent_nano_usd",
                    "reserved_nano_usd",
                    "chat_input_tokens",
                    "chat_cached_input_tokens",
                    "chat_output_tokens",
                    "embedding_tokens",
                    "created_at",
                    "updated_at"
                )
                VALUES (
                    ${userId},
                    ${usageDate}::date,
                    0,
                    ${amountNanoUsd},
                    0,
                    0,
                    0,
                    0,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )

                ON CONFLICT (
                    "user_id",
                    "usage_date"
                )
                DO UPDATE
                SET
                    "reserved_nano_usd" =
                        "ai_daily_usage"."reserved_nano_usd" +
                        EXCLUDED."reserved_nano_usd",

                    "updated_at" =
                        CURRENT_TIMESTAMP

                WHERE
                    "ai_daily_usage"."spent_nano_usd" +
                    "ai_daily_usage"."reserved_nano_usd" +
                    EXCLUDED."reserved_nano_usd"
                    <= ${this.dailyBudgetNanoUsd}

                RETURNING
                    "reserved_nano_usd"
                    AS "reservedNanoUsd"
            `;

        if (rows.length === 0) {
            throw new DailyAiBudgetExceededException(
                this.getNextUtcDate(
                    usageDate,
                ),
            );
        }

        return {
            userId,
            usageDate,
            amountNanoUsd,
        };
    }

    private calculateCostNanoUsd(
        usage: Required<AiTokenUsage>,
    ): bigint {
        const regularInputTokens =
            Math.max(
                usage.chatInputTokens -
                usage
                    .chatCachedInputTokens,
                0,
            );

        const cost =
            regularInputTokens *
            this
                .chatInputNanoUsdPerToken +
            usage.chatCachedInputTokens *
            this
                .chatCachedInputNanoUsdPerToken +
            usage.chatOutputTokens *
            this
                .chatOutputNanoUsdPerToken +
            usage.embeddingTokens *
            this
                .embeddingNanoUsdPerToken;

        return BigInt(
            Math.ceil(cost),
        );
    }

    private normalizeUsage(
        usage: AiTokenUsage,
    ): Required<AiTokenUsage> {
        return {
            chatInputTokens:
                this.normalizeTokenCount(
                    usage.chatInputTokens,
                ),

            chatCachedInputTokens:
                this.normalizeTokenCount(
                    usage
                        .chatCachedInputTokens,
                ),

            chatOutputTokens:
                this.normalizeTokenCount(
                    usage.chatOutputTokens,
                ),

            embeddingTokens:
                this.normalizeTokenCount(
                    usage.embeddingTokens,
                ),
        };
    }

    private normalizeTokenCount(
        value: number | undefined,
    ): number {
        return Math.max(
            0,
            Math.trunc(value ?? 0),
        );
    }

    private usdToNanoUsd(
        value: number,
    ): bigint {
        return BigInt(
            Math.round(
                value *
                NANO_USD_PER_USD,
            ),
        );
    }

    private pricePerMillionToNanoUsdPerToken(
        value: number,
    ): number {
        return (
            value *
            NANO_USD_PER_USD /
            TOKENS_PER_MILLION
        );
    }

    private getCurrentUtcDate(): Date {
        const now = new Date();

        return new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
            ),
        );
    }

    private getNextUtcDate(
        usageDate: Date,
    ): Date {
        return new Date(
            usageDate.getTime() +
            24 * 60 * 60 * 1000,
        );
    }
}
