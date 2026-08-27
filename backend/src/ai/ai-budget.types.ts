export type AiTokenUsage = {
    chatInputTokens?: number;
    chatCachedInputTokens?: number;
    chatOutputTokens?: number;
    embeddingTokens?: number;
};

export type AiBudgetReservation = {
    userId: string;
    usageDate: Date;
    amountNanoUsd: bigint;
};
