'use client';

import { useIsMutating } from '@tanstack/react-query';

export const appOperationKeys = {
    all: ['app-operation'] as const,

    upload: ['app-operation', 'document-upload'] as const,

    retry: ['app-operation', 'document-retry'] as const,

    streaming: ['app-operation', 'chat-streaming'] as const,
};

export function useAppOperationState() {
    const uploadCount = useIsMutating({
        mutationKey: appOperationKeys.upload,
        exact: true,
    });

    const retryCount = useIsMutating({
        mutationKey: appOperationKeys.retry,
        exact: true,
    });

    const streamingCount = useIsMutating({
        mutationKey: appOperationKeys.streaming,
        exact: true,
    });

    const isUploading = uploadCount > 0;

    const isRetrying = retryCount > 0;

    const isStreaming = streamingCount > 0;

    return {
        isUploading,
        isRetrying,
        isStreaming,

        isBusy: isUploading || isRetrying || isStreaming,
    };
}
