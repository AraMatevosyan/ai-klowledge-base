import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteDocument,
    getDocuments,
    retryDocument,
    uploadDocument,
} from './documents.api';
import { appOperationKeys } from '@/lib/app-operation';

export const documentKeys = {
    all: ['documents'] as const,

    list: () => [...documentKeys.all, 'list'] as const,
};

export function useDocuments() {
    return useQuery({
        queryKey: documentKeys.list(),
        queryFn: getDocuments,
    });
}

export function useUploadDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: uploadDocument,
        mutationKey: appOperationKeys.upload,

        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: documentKeys.all,
            });
        },
    });
}

export function useDeleteDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: deleteDocument,

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: documentKeys.all,
            });
        },
    });
}

export function useRetryDocument() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: retryDocument,
        mutationKey: appOperationKeys.upload,

        onSettled: async () => {
            await queryClient.invalidateQueries({
                queryKey: documentKeys.list(),
            });
        },
    });
}
