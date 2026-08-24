import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

type HttpExceptionBody = {
    message?: string | string[];
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    constructor(
        private readonly configService: ConfigService,
    ) {}

    catch(
        exception: unknown,
        host: ArgumentsHost,
    ): void {
        const context = host.switchToHttp();

        const request =
            context.getRequest<Request>();

        const response =
            context.getResponse<Response>();

        const statusCode =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        if (statusCode >= 500) {
            this.logServerError(
                request,
                statusCode,
                exception,
            );
        }

        if (response.headersSent) {
            if (!response.writableEnded) {
                response.end();
            }

            return;
        }

        response.status(statusCode).json({
            statusCode,
            message: this.getResponseMessage(
                exception,
                statusCode,
            ),
            timestamp: new Date().toISOString(),
            path: request.originalUrl,
        });
    }

    private getResponseMessage(
        exception: unknown,
        statusCode: number,
    ): string | string[] {
        const isProduction =
            this.configService.get<string>(
                'NODE_ENV',
            ) === 'production';

        if (
            statusCode >= 500 &&
            isProduction
        ) {
            return 'An unexpected error occurred.';
        }

        if (!(exception instanceof HttpException)) {
            return 'An unexpected error occurred.';
        }

        const exceptionResponse =
            exception.getResponse();

        if (typeof exceptionResponse === 'string') {
            return exceptionResponse;
        }

        if (
            typeof exceptionResponse === 'object' &&
            exceptionResponse !== null
        ) {
            const body =
                exceptionResponse as HttpExceptionBody;

            if (body.message) {
                return body.message;
            }
        }

        return exception.message;
    }

    private logServerError(
        request: Request,
        statusCode: number,
        exception: unknown,
    ): void {
        const message =
            `${request.method} ` +
            `${request.originalUrl} ` +
            `${statusCode}`;

        const stack =
            exception instanceof Error
                ? exception.stack
                : undefined;

        this.logger.error(message, stack);
    }
}
