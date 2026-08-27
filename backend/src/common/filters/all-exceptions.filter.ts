import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import {
    ConfigService,
} from '@nestjs/config';
import type {
    Request,
    Response,
} from 'express';

type HttpExceptionBody = {
    message?: string | string[];
    code?: string;
    resetAt?: string;
};

type ErrorResponse = {
    statusCode: number;
    message: string | string[];
    timestamp: string;
    path: string;
    code?: string;
    resetAt?: string;
};

@Catch()
export class AllExceptionsFilter
    implements ExceptionFilter
{
    private readonly logger =
        new Logger(
            AllExceptionsFilter.name,
        );

    constructor(
        private readonly configService:
        ConfigService,
    ) {}

    catch(
        exception: unknown,
        host: ArgumentsHost,
    ): void {
        const context =
            host.switchToHttp();

        const request =
            context.getRequest<Request>();

        const response =
            context.getResponse<Response>();

        const statusCode =
            exception instanceof
            HttpException
                ? exception.getStatus()
                : HttpStatus
                    .INTERNAL_SERVER_ERROR;

        if (statusCode >= 500) {
            this.logServerError(
                request,
                statusCode,
                exception,
            );
        }

        if (response.headersSent) {
            if (
                !response.writableEnded
            ) {
                response.end();
            }

            return;
        }

        const exceptionBody =
            this.getHttpExceptionBody(
                exception,
            );

        const errorResponse:
            ErrorResponse = {
            statusCode,

            message:
                this.getResponseMessage(
                    exception,
                    statusCode,
                    exceptionBody,
                ),

            timestamp:
                new Date().toISOString(),

            path:
            request.originalUrl,
        };

        /*
         * Only expose structured metadata
         * for expected client errors.
         */
        if (statusCode < 500) {
            if (exceptionBody?.code) {
                errorResponse.code =
                    exceptionBody.code;
            }

            if (
                exceptionBody?.resetAt
            ) {
                errorResponse.resetAt =
                    exceptionBody.resetAt;
            }
        }

        response
            .status(statusCode)
            .json(errorResponse);
    }

    private getHttpExceptionBody(
        exception: unknown,
    ): HttpExceptionBody | null {
        if (
            !(
                exception instanceof
                HttpException
            )
        ) {
            return null;
        }

        const exceptionResponse =
            exception.getResponse();

        if (
            typeof exceptionResponse !==
            'object' ||
            exceptionResponse === null
        ) {
            return null;
        }

        return exceptionResponse as
            HttpExceptionBody;
    }

    private getResponseMessage(
        exception: unknown,
        statusCode: number,
        body: HttpExceptionBody | null,
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

        if (
            !(
                exception instanceof
                HttpException
            )
        ) {
            return 'An unexpected error occurred.';
        }

        const exceptionResponse =
            exception.getResponse();

        if (
            typeof exceptionResponse ===
            'string'
        ) {
            return exceptionResponse;
        }

        if (body?.message) {
            return body.message;
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

        this.logger.error(
            message,
            stack,
        );
    }
}
