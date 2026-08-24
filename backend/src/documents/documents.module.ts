import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PdfProcessorService } from './pdf-processor.service';
import { TextChunkerService } from './text-chunker.service';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [PrismaModule, AuthModule, AiModule],
    controllers: [DocumentsController],
    providers: [DocumentsService, PdfProcessorService, TextChunkerService],
})
export class DocumentsModule {}
