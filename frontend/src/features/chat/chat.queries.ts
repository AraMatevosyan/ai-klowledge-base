'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearChatHistory, getChatMessages } from './chat.api';
import { ChatMessagesResponse } from '@/features/chat/chat.types';

export const chatKeys = {
    all: ['chat'] as const,

    messages: () => [...chatKeys.all, 'messages'] as const,
};

export function useChatMessages() {
    return useQuery({
        queryKey: chatKeys.messages(),
        queryFn: getChatMessages,
        retry: false,
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
    });
}

export function useClearChatHistory() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: clearChatHistory,

        onSuccess: () => {
            queryClient.setQueryData<ChatMessagesResponse>(
                chatKeys.messages(),
                {
                    messages: [],
                },
            );
        },
    });
}
