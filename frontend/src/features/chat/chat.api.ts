import type { ChatMessagesResponse, ChatStreamEvent } from './chat.types';
import { apiRequest } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

type AskQuestionStreamOptions = {
    question: string;
    signal?: AbortSignal;
    onEvent: (event: ChatStreamEvent) => void;
};

async function getErrorMessage(response: Response): Promise<string> {
    const responseText = await response.text();

    if (!responseText) {
        return `Request failed with status ${response.status}.`;
    }

    try {
        const data = JSON.parse(responseText) as {
            message?: string | string[];
        };

        if (Array.isArray(data.message)) {
            return data.message.join(', ');
        }

        return data.message ?? `Request failed with status ${response.status}.`;
    } catch {
        return responseText;
    }
}

export async function askQuestionStream({
    question,
    signal,
    onEvent,
}: AskQuestionStreamOptions): Promise<void> {
    const response = await fetch(`${API_URL}/chat/ask/stream`, {
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
        throw new Error(await getErrorMessage(response));
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
            throw new Error(event.message);
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
    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/chat/messages`,
        {
            method: 'DELETE',
            credentials: 'include',
        },
    );

    if (!response.ok) {
        const error = await response.json().catch(() => null);

        throw new Error(error?.message ?? 'Failed to clear chat history.');
    }

    return response.json();
}
