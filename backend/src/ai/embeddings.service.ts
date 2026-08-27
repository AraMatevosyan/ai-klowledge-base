import {
    BadGatewayException,
    Injectable,
    Logger,
    UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type OpenAI from 'openai';
import { AiBudgetService } from './ai-budget.service';
import type { AiBudgetReservation } from './ai-budget.types';
import { OpenAiClientService } from './openai-client.service';

export const EMBEDDING_DIMENSIONS = 1536;

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

const EMBEDDING_BATCH_SIZE = 100;

@Injectable()
export class EmbeddingsService {
    private readonly logger = new Logger(EmbeddingsService.name);

    private readonly model: string;

    constructor(
        private readonly configService: ConfigService,

        private readonly openAiClient: OpenAiClientService,

        private readonly aiBudgetService: AiBudgetService,
    ) {
        this.model =
            this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
            DEFAULT_EMBEDDING_MODEL;
    }

    async createMany(userId: string, inputs: string[]): Promise<number[][]> {
        if (inputs.length === 0) {
            return [];
        }

        if (inputs.some((input) => input.trim().length === 0)) {
            throw new UnprocessableEntityException(
                'Embedding input cannot be empty.',
            );
        }

        /*
         * getClient() is called before reserving money.
         * If the API key is missing, no budget reservation
         * will be created.
         */
        const client = this.openAiClient.getClient();

        const embeddings: number[][] = [];

        for (
            let start = 0;
            start < inputs.length;
            start += EMBEDDING_BATCH_SIZE
        ) {
            const batch = inputs.slice(start, start + EMBEDDING_BATCH_SIZE);

            /*
             * Reserve the maximum estimated cost
             * before making the OpenAI request.
             *
             * DailyAiBudgetExceededException is not
             * caught here and will remain an HTTP 429.
             */
            const reservation = await this.aiBudgetService.reserveForEmbedding(
                userId,
                batch,
            );

            const response = await this.requestBatch(
                client,
                reservation,
                batch,
            );

            /*
             * OpenAI successfully processed the request,
             * so the money has already been spent.
             *
             * Settle the reservation using the actual
             * number of tokens returned by OpenAI.
             */
            await this.aiBudgetService.settle(reservation, {
                embeddingTokens: response.usage.total_tokens,
            });

            const orderedEmbeddings = [...response.data].sort(
                (first, second) => first.index - second.index,
            );

            if (orderedEmbeddings.length !== batch.length) {
                this.logger.error(
                    JSON.stringify({
                        message:
                            'Embedding response length does not match input length',
                        expected: batch.length,
                        received: orderedEmbeddings.length,
                    }),
                );

                throw new BadGatewayException('Failed to generate embeddings');
            }

            for (const item of orderedEmbeddings) {
                if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
                    this.logger.error(
                        JSON.stringify({
                            message: 'Unexpected embedding dimensions',
                            expected: EMBEDDING_DIMENSIONS,
                            received: item.embedding.length,
                        }),
                    );

                    throw new BadGatewayException(
                        'Failed to generate embeddings',
                    );
                }

                const hasInvalidValue = item.embedding.some(
                    (value) => !Number.isFinite(value),
                );

                if (hasInvalidValue) {
                    this.logger.error(
                        JSON.stringify({
                            message: 'Embedding contains an invalid number',
                        }),
                    );

                    throw new BadGatewayException(
                        'Failed to generate embeddings',
                    );
                }

                embeddings.push(item.embedding);
            }
        }

        return embeddings;
    }

    async createOne(userId: string, input: string): Promise<number[]> {
        const embeddings = await this.createMany(userId, [input]);

        const embedding = embeddings[0];

        if (!embedding) {
            throw new BadGatewayException('Failed to generate query embedding');
        }

        return embedding;
    }

    private async requestBatch(
        client: OpenAI,
        reservation: AiBudgetReservation,
        batch: string[],
    ) {
        try {
            return await client.embeddings.create({
                model: this.model,
                input: batch,
                dimensions: EMBEDDING_DIMENSIONS,
                encoding_format: 'float',
            });
        } catch (error) {
            /*
             * The OpenAI request failed, therefore
             * the reserved money was not spent.
             */
            await this.releaseReservationSafely(reservation);

            this.logApiError(error);

            throw new BadGatewayException('Failed to generate embeddings');
        }
    }

    private async releaseReservationSafely(
        reservation: AiBudgetReservation,
    ): Promise<void> {
        try {
            await this.aiBudgetService.release(reservation);
        } catch (error) {
            this.logger.error(
                'Failed to release AI budget reservation',
                error instanceof Error ? error.stack : undefined,
            );
        }
    }

    private logApiError(error: unknown): void {
        const apiError = error as {
            name?: string;
            status?: number;
            code?: string;
            type?: string;
            message?: string;
            request_id?: string;
            requestID?: string;
        };

        this.logger.error(
            JSON.stringify({
                name: apiError.name,
                status: apiError.status,
                code: apiError.code,
                type: apiError.type,
                message: apiError.message,
                requestId: apiError.request_id ?? apiError.requestID,
            }),
        );
    }
}
