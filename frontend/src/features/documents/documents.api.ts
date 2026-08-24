import { apiRequest } from '@/lib/api';
import {
    DocumentsResponse,
    KnowledgeDocument,
    UploadDocumentResponse,
} from './documents.types';

export function getDocuments() {
    return apiRequest<DocumentsResponse>('/documents');
}

export function uploadDocument(file: File) {
    const formData = new FormData();

    formData.append('file', file);

    return apiRequest<UploadDocumentResponse>('/documents/upload', {
        method: 'POST',
        body: formData,
    });
}

export function deleteDocument(documentId: string) {
    return apiRequest<void>(`/documents/${documentId}`, {
        method: 'DELETE',
    });
}

type RetryDocumentResponse = {
    document: KnowledgeDocument;
};

export async function retryDocument(
    documentId: string,
): Promise<RetryDocumentResponse> {
    const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${documentId}/retry`,
        {
            method: 'POST',
            credentials: 'include',
        },
    );

    if (!response.ok) {
        const error = await response.json().catch(() => null);

        throw new Error(
            error?.message ?? 'Failed to retry document processing.',
        );
    }

    return response.json();
}
