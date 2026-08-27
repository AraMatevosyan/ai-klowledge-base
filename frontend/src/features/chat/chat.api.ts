import type { ChatMessagesResponse, ChatStreamEvent } from './chat.types';
import { apiRequest } from '@/lib/api';

type AskQuestionStreamOptions = {
    question: string;
    signal?: AbortSignal;
    onEvent: (event: ChatStreamEvent) => void;
};

type ChatErrorResponse = {
    message?: string | string[];
    code?: string;
    resetAt?: string;
};

export class ChatRequestError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly resetAt?: string,
    ) {
        super(message);

        this.name = 'ChatRequestError';
    }
}

function normalizeErrorMessage(
    message: string | string[] | undefined,
    fallbackMessage: string,
): string {
    if (Array.isArray(message)) {
        return message.join(', ');
    }

    return message ?? fallbackMessage;
}

async function createResponseError(
    response: Response,
): Promise<ChatRequestError> {
    const fallbackMessage = `Request failed with status ${response.status}.`;

    const responseText = await response.text();

    if (!responseText) {
        return new ChatRequestError(fallbackMessage);
    }

    try {
        const data = JSON.parse(responseText) as ChatErrorResponse;

        return new ChatRequestError(
            normalizeErrorMessage(data.message, fallbackMessage),
            data.code,
            data.resetAt,
        );
    } catch {
        return new ChatRequestError(responseText);
    }
}

export async function askQuestionStream({
    question,
    signal,
    onEvent,
}: AskQuestionStreamOptions): Promise<void> {
    const response = await fetch('/api/chat/ask/stream', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question,
        }),
        signal,
    });

    if (!response.ok) {
        throw await createResponseError(response);
    }

    if (!response.body) {
        throw new Error('Streaming is not supported by this browser.');
    }

    const reader = response.body.getReader();

    const decoder = new TextDecoder();

    let buffer = '';
    let isComplete = false;

    const processLine = (line: string) => {
        const normalizedLine = line.trim();

        if (!normalizedLine) {
            return;
        }

        let event: ChatStreamEvent;

        try {
            event = JSON.parse(normalizedLine) as ChatStreamEvent;
        } catch {
            throw new Error('The server returned an invalid stream event.');
        }

        if (event.type === 'error') {
            throw new ChatRequestError(
                event.message,
                event.code,
                event.resetAt,
            );
        }

        if (event.type === 'complete') {
            isComplete = true;
        }

        onEvent(event);
    };

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value, {
                stream: true,
            });

            const lines = buffer.split('\n');

            buffer = lines.pop() ?? '';

            for (const line of lines) {
                processLine(line);
            }
        }

        buffer += decoder.decode();

        if (buffer.trim()) {
            processLine(buffer);
        }

        if (!isComplete) {
            throw new Error('The response stream ended unexpectedly.');
        }
    } finally {
        reader.releaseLock();
    }
}

export function getChatMessages(): Promise<ChatMessagesResponse> {
    return apiRequest<ChatMessagesResponse>('/chat/messages');
}

export type ClearChatHistoryResponse = {
    deletedCount: number;
};

export async function clearChatHistory(): Promise<ClearChatHistoryResponse> {
    const response = await fetch('/api/chat/messages', {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json().catch(() => null);

        throw new Error(error?.message ?? 'Failed to clear chat history.');
    }

    return response.json();
}
