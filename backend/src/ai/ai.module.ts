import { Module } from '@nestjs/common';
import { OpenAiClientService } from './openai-client.service';
import { EmbeddingsService } from './embeddings.service';
import { AnswerGenerationService } from './answer-generation.service';

@Module({
    providers: [
        OpenAiClientService,
        EmbeddingsService,
        AnswerGenerationService,
    ],
    exports: [EmbeddingsService, AnswerGenerationService],
})
export class AiModule {}
