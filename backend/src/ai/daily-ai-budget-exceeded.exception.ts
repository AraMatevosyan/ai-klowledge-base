import {
    HttpException,
    HttpStatus,
} from '@nestjs/common';

export class DailyAiBudgetExceededException extends HttpException {
    constructor(
        resetAt: Date,
    ) {
        super(
            {
                statusCode:
                HttpStatus.TOO_MANY_REQUESTS,

                code:
                    'DAILY_AI_BUDGET_EXCEEDED',

                message:
                    'You have reached your daily AI usage limit. Please try again tomorrow.',

                resetAt:
                    resetAt.toISOString(),
            },
            HttpStatus.TOO_MANY_REQUESTS,
        );
    }
}
