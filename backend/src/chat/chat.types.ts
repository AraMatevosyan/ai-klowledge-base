export type ChatAnswerStatus =
    | 'NO_DOCUMENTS'
    | 'DOCUMENTS_NOT_READY'
    | 'NO_SEARCHABLE_CONTENT'
    | 'NO_RELEVANT_CONTEXT'
    | 'DOCUMENT_SELECTION_REQUIRED'
    | 'ANSWERED';

export type ChatSource = {
    sourceNumber: number;
    documentId: string;
    documentName: string;
    pageNumber: number;
    excerpt: string;
};

export type ChatAnswerResponse = {
    status: ChatAnswerStatus;
    question: string;
    answer: string;
    sources: ChatSource[];
};
