export type DocumentStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';

export type KnowledgeDocument = {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    status: DocumentStatus;
    pageCount: number | null;
    chunkCount: number;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
};

export type DocumentsResponse = {
    documents: KnowledgeDocument[];
};

export type UploadDocumentResponse = {
    document: KnowledgeDocument;
};
