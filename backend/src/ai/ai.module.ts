import { Module } from '@nestjs/common';
import { OpenAiClientService } from './openai-client.service';
import { EmbeddingsService } from './embeddings.service';
import { AnswerGenerationService } from './answer-generation.service';
import { AiBudgetService } from './ai-budget.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [
        OpenAiClientService,
        EmbeddingsService,
        AnswerGenerationService,
        AiBudgetService,
    ],
    exports: [EmbeddingsService, AnswerGenerationService, AiBudgetService],
})
export class AiModule {}
