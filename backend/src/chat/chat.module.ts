import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule, AuthModule, SearchModule, AiModule],
    controllers: [ChatController],
    providers: [ChatService],
})
export class ChatModule {}
