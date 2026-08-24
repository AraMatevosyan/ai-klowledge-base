import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Logger,
    Post,
    Res,
    UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import { AskQuestionDto } from './dto/ask-question.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

type AuthenticatedUser = {
    id: string;
    email: string;
};

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    private readonly logger = new Logger(ChatController.name);

    constructor(private readonly chatService: ChatService) {}

    @Post('ask')
    @HttpCode(HttpStatus.OK)
    ask(
        @CurrentUser()
        user: AuthenticatedUser,

        @Body()
        askQuestionDto: AskQuestionDto,
    ) {
        return this.chatService.askQuestion(user.id, askQuestionDto.question);
    }

    @Post('ask/stream')
    @HttpCode(HttpStatus.OK)
    async askStream(
        @CurrentUser()
        user: AuthenticatedUser,

        @Body()
        dto: AskQuestionDto,

        @Res()
        response: Response,
    ): Promise<void> {
        response.status(HttpStatus.OK);

        response.setHeader(
            'Content-Type',
            'application/x-ndjson; charset=utf-8',
        );

        response.setHeader('Cache-Control', 'no-cache, no-transform');

        response.setHeader('Connection', 'keep-alive');

        response.setHeader('X-Accel-Buffering', 'no');

        response.flushHeaders();

        try {
            const result = await this.chatService.askQuestion(
                user.id,
                dto.question,
                (delta) => {
                    if (response.destroyed || response.writableEnded) {
                        return;
                    }

                    response.write(
                        `${JSON.stringify({
                            type: 'delta',
                            content: delta,
                        })}\n`,
                    );
                },
            );

            if (!response.destroyed) {
                response.write(
                    `${JSON.stringify({
                        type: 'complete',
                        data: result,
                    })}\n`,
                );
            }
        } catch (error) {
            this.logger.error(
                'Failed to stream an answer',
                error instanceof Error ? error.stack : undefined,
            );

            if (!response.destroyed && !response.writableEnded) {
                response.write(
                    `${JSON.stringify({
                        type: 'error',
                        message:
                            'Unable to generate an answer. Please try again.',
                    })}\n`,
                );
            }
        } finally {
            if (!response.writableEnded && !response.destroyed) {
                response.end();
            }
        }
    }

    @Get('messages')
    getMessages(
        @CurrentUser()
        user: AuthenticatedUser,
    ) {
        return this.chatService.getMessages(user.id);
    }

    @Delete('messages')
    @HttpCode(HttpStatus.OK)
    clearMessages(@CurrentUser() user: AuthenticatedUser) {
        return this.chatService.clearMessages(user.id);
    }
}
