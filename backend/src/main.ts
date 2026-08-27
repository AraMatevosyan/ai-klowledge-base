import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.use(helmet());

    const configService = app.get(ConfigService);

    const port = configService.getOrThrow<number>('PORT');

    const frontendUrl = configService.getOrThrow<string>('FRONTEND_URL');

    const frontendOrigin = new URL(frontendUrl).origin;

    const trustProxyHops = configService.get<number>('TRUST_PROXY_HOPS', 0);

    if (trustProxyHops > 0) {
        const expressApplication = app
            .getHttpAdapter()
            .getInstance() as Express;

        expressApplication.set('trust proxy', trustProxyHops);
    }

    app.useGlobalFilters(new AllExceptionsFilter(configService));

    app.setGlobalPrefix('api');

    app.use(cookieParser());

    app.enableCors({
        origin: frontendOrigin,
        credentials: true,

        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],

        allowedHeaders: ['Content-Type', 'Authorization'],

        maxAge: 86400,
    });

    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    app.enableShutdownHooks();

    await app.listen(port, '0.0.0.0');
}

const bootstrapLogger = new Logger('Bootstrap');

void bootstrap().catch((error: unknown) => {
    const stack = error instanceof Error ? error.stack : String(error);

    bootstrapLogger.error('Failed to start application', stack);

    process.exit(1);
});
