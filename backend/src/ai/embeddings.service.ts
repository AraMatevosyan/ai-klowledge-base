import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    ) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');

        this.model =
            this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ??
            DEFAULT_EMBEDDING_MODEL;
    }

    async createMany(inputs: string[]): Promise<number[][]> {
        const client = this.openAiClient.getClient();

        if (inputs.length === 0) {
            return [];
        }

        const embeddings: number[][] = [];

        try {
            for (
                let start = 0;
                start < inputs.length;
                start += EMBEDDING_BATCH_SIZE
            ) {
                const batch = inputs.slice(start, start + EMBEDDING_BATCH_SIZE);

                const response = await client.embeddings.create({
                    model: this.model,
                    input: batch,
                    dimensions: EMBEDDING_DIMENSIONS,
                    encoding_format: 'float',
                });

                const orderedEmbeddings = [...response.data].sort(
                    (first, second) => first.index - second.index,
                );

                if (orderedEmbeddings.length !== batch.length) {
                    throw new Error(
                        'Embedding response length does not match input length',
                    );
                }

                for (const item of orderedEmbeddings) {
                    if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
                        throw new Error(
                            `Expected ${EMBEDDING_DIMENSIONS} dimensions, received ${item.embedding.length}`,
                        );
                    }

                    const hasInvalidValue = item.embedding.some(
                        (value) => !Number.isFinite(value),
                    );

                    if (hasInvalidValue) {
                        throw new Error('Embedding contains an invalid number');
                    }

                    embeddings.push(item.embedding);
                }
            }

            return embeddings;
        } catch (error) {
            const apiError = error as {
                name?: string;
                status?: number;
                code?: string;
                type?: string;
                message?: string;
                request_id?: string;
                requestID?: string;
                stack?: string;
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

            throw new BadGatewayException('Failed to generate embeddings');
        }
    }

    async createOne(input: string): Promise<number[]> {
        const [embedding] = await this.createMany([input]);

        if (!embedding) {
            throw new BadGatewayException('Failed to generate query embedding');
        }

        return embedding;
    }
}
