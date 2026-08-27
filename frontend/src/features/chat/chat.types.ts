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

export type AskQuestionResponse = {
    status: ChatAnswerStatus;
    question: string;
    answer: string;
    sources: ChatSource[];
};

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    status?: ChatAnswerStatus;
    sources?: ChatSource[];
    createdAt?: string;
};

export type ChatMessagesResponse = {
    messages: ChatMessage[];
};

export const DAILY_AI_BUDGET_EXCEEDED_CODE =
    'DAILY_AI_BUDGET_EXCEEDED' as const;

export type ChatStreamErrorEvent = {
    type: 'error';
    message: string;
    code?: string;
    resetAt?: string;
};

export type ChatStreamEvent =
    | {
          type: 'delta';
          content: string;
      }
    | {
          type: 'complete';
          data: AskQuestionResponse;
      }
    | ChatStreamErrorEvent;
