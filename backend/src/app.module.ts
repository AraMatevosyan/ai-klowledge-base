import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { SearchModule } from './search/search.module';
import { ChatModule } from './chat/chat.module';
import * as Joi from 'joi';
import { DEFAULT_AUTH_TOKEN_TTL_SECONDS } from './auth/auth.constants';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            cache: true,

            validationSchema: Joi.object({
                NODE_ENV: Joi.string()
                    .valid('development', 'test', 'production')
                    .default('development'),

                PORT: Joi.number().port().default(3001),

                DATABASE_URL: Joi.string()
                    .uri({
                        scheme: ['postgresql', 'postgres'],
                    })
                    .required(),

                JWT_SECRET: Joi.string().min(32).required(),

                JWT_EXPIRES_IN_SECONDS: Joi.number()
                    .integer()
                    .positive()
                    .default(DEFAULT_AUTH_TOKEN_TTL_SECONDS),

                AUTH_COOKIE_SAME_SITE: Joi.string()
                    .valid('lax', 'strict', 'none')
                    .default('lax'),

                TRUST_PROXY_HOPS: Joi.number()
                    .integer()
                    .min(0)
                    .max(5)
                    .default(0),

                OPENAI_API_KEY: Joi.string().min(1).required(),

                OPENAI_CHAT_MODEL: Joi.string().default('gpt-4.1-mini'),

                OPENAI_EMBEDDING_MODEL: Joi.string().default(
                    'text-embedding-3-small',
                ),

                FRONTEND_URL: Joi.string()
                    .uri({
                        scheme: ['http', 'https'],
                    })
                    .required(),

                UPLOAD_DIR: Joi.string().default('storage/documents'),
                DAILY_AI_BUDGET_USD: Joi.number()
                    .positive()
                    .precision(6)
                    .default(0.1),

                OPENAI_CHAT_INPUT_USD_PER_MILLION_TOKENS: Joi.number()
                    .positive()
                    .default(0.4),

                OPENAI_CHAT_CACHED_INPUT_USD_PER_MILLION_TOKENS: Joi.number()
                    .positive()
                    .default(0.1),

                OPENAI_CHAT_OUTPUT_USD_PER_MILLION_TOKENS: Joi.number()
                    .positive()
                    .default(1.6),

                OPENAI_EMBEDDING_USD_PER_MILLION_TOKENS: Joi.number()
                    .positive()
                    .default(0.02),
            }),

            validationOptions: {
                allowUnknown: true,
                abortEarly: false,
            },
        }),
        AuthModule,
        DocumentsModule,
        SearchModule,
        ChatModule,
    ],

    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
