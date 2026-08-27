import {
    HttpException,
    HttpStatus,
} from '@nestjs/common';

export const DAILY_AI_BUDGET_EXCEEDED_CODE =
    'DAILY_AI_BUDGET_EXCEEDED' as const;

export type DailyAiBudgetExceededResponse = {
    statusCode: number;
    code:
        typeof DAILY_AI_BUDGET_EXCEEDED_CODE;
    message: string;
    resetAt: string;
};

export class DailyAiBudgetExceededException extends HttpException {
    constructor(resetAt: Date) {
        const response:
            DailyAiBudgetExceededResponse = {
            statusCode:
            HttpStatus.TOO_MANY_REQUESTS,

            code:
            DAILY_AI_BUDGET_EXCEEDED_CODE,

            message:
                'You have reached your daily AI usage limit. Please try again after the limit resets.',

            resetAt:
                resetAt.toISOString(),
        };

        super(
            response,
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }

    getBody():
        DailyAiBudgetExceededResponse {
        return this.getResponse() as
            DailyAiBudgetExceededResponse;
    }
}
