import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QueryIntentClassifierService } from './query-intent-classifier.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
    imports: [PrismaModule, AuthModule, AiModule],

    controllers: [SearchController],

    providers: [QueryIntentClassifierService, SearchService],

    exports: [SearchService],
})
export class SearchModule {}
