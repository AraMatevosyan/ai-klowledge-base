import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiClientService {
    private readonly client: OpenAI | null;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');

        this.client = apiKey ? new OpenAI({ apiKey }) : null;
    }

    getClient(): OpenAI {
        if (!this.client) {
            throw new ServiceUnavailableException(
                'OPENAI_API_KEY is not configured',
            );
        }

        return this.client;
    }
}
