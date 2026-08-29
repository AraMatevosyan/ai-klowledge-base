import { Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DailyAiBudgetExceededException } from '../ai/daily-ai-budget-exceeded.exception';
import { ChatController } from './chat.controller';
import type { ChatService } from './chat.service';

const user = {
    id: 'user-1',
    email: 'ara@example.com',
};

const dto = {
    question: 'What does Ara do?',
};

function createResponseMock() {
    const status = jest.fn();
    const setHeader = jest.fn();
    const flushHeaders = jest.fn();
    const write = jest.fn<boolean, [string]>();
    const end = jest.fn();

    const response = {
        destroyed: false,
        writableEnded: false,
        status,
        setHeader,
        flushHeaders,
        write,
        end,
    } as unknown as Response;

    status.mockReturnValue(response);

    return {
        response,
        status,
        setHeader,
        flushHeaders,
        write,
        end,
    };
}

describe('ChatController daily AI budget', () => {
    let controller: ChatController;

    const chatService = {
        askQuestion: jest.fn(),
        getMessages: jest.fn(),
        clearMessages: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        jest.spyOn(Logger.prototype, 'warn').mockImplementation(
            () => undefined,
        );

        jest.spyOn(Logger.prototype, 'error').mockImplementation(
            () => undefined,
        );

        controller = new ChatController(chatService as unknown as ChatService);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('preserves the budget exception for the regular endpoint', async () => {
        const budgetError = new DailyAiBudgetExceededException(
            new Date('2026-08-28T00:00:00.000Z'),
        );

        chatService.askQuestion.mockRejectedValue(budgetError);

        await expect(controller.ask(user, dto)).rejects.toBe(budgetError);

        expect(chatService.askQuestion).toHaveBeenCalledWith(
            'user-1',
            dto.question,
        );
    });

    it('writes the budget error as an NDJSON stream event', async () => {
        const budgetError = new DailyAiBudgetExceededException(
            new Date('2026-08-28T00:00:00.000Z'),
        );

        chatService.askQuestion.mockRejectedValue(budgetError);

        const responseMock = createResponseMock();

        await controller.askStream(user, dto, responseMock.response);

        expect(responseMock.status).toHaveBeenCalledWith(200);

        expect(responseMock.setHeader).toHaveBeenCalledWith(
            'Content-Type',
            'application/x-ndjson; charset=utf-8',
        );

        expect(responseMock.flushHeaders).toHaveBeenCalledTimes(1);

        expect(responseMock.write).toHaveBeenCalledTimes(1);

        const writtenLine = responseMock.write.mock.calls[0][0];

        expect(writtenLine.endsWith('\n')).toBe(true);

        const parsedLine: unknown = JSON.parse(writtenLine);

        expect(parsedLine).toEqual({
            type: 'error',

            code: 'DAILY_AI_BUDGET_EXCEEDED',

            message: expect.any(String) as unknown,

            resetAt: '2026-08-28T00:00:00.000Z',
        });

        expect(responseMock.end).toHaveBeenCalledTimes(1);
    });
});
