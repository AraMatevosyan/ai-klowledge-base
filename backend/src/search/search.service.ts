import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmbeddingsService } from '../ai/embeddings.service';
import { detectQueryIntent, QueryIntent } from './query-intent';

const MIN_SIMILARITY = 0.2;

const CANDIDATE_LIMIT = 15;
const FACTUAL_CONTEXT_LIMIT = 5;

const MAX_SELECTED_DOCUMENTS = 3;
const DOCUMENT_SCORE_MARGIN = 0.15;

const EXHAUSTIVE_CHUNKS_PER_DOCUMENT = 6;
const EXHAUSTIVE_CONTEXT_LIMIT = 12;

const COMPARISON_CHUNKS_PER_DOCUMENT = 3;

const SUMMARY_CHUNKS_PER_DOCUMENT = 2;
const SINGLE_SUMMARY_CHUNK_LIMIT = 5;
const MAX_SUMMARY_DOCUMENTS = 5;

type SearchRow = {
    chunkId: string;
    documentId: string;
    documentName: string;
    pageNumber: number;
    chunkIndex: number;
    content: string;
    similarity: number;
};

type ReadyDocument = {
    id: string;
    name: string;
    chunkCount: number;
};

type RankedDocument = {
    documentId: string;
    documentName: string;
    score: number;
    chunks: SearchResult[];
};

export type SearchAvailability = {
    documentCount: number;
    readyDocumentCount: number;
    searchableChunkCount: number;
};

export type SearchResult = SearchRow;

export type ChatRetrievalResult =
    | {
          status: 'FOUND';
          results: SearchResult[];
      }
    | {
          status: 'NO_RELEVANT_CONTEXT' | 'DOCUMENT_SELECTION_REQUIRED';
          results: [];
      };

@Injectable()
export class SearchService {
    constructor(
        private readonly prisma: PrismaService,

        private readonly embeddingsService: EmbeddingsService,
    ) {}

    async retrieveForChat(
        userId: string,
        query: string,
    ): Promise<ChatRetrievalResult> {
        const normalizedQuery = query.trim();

        const intent = detectQueryIntent(normalizedQuery);

        if (intent === QueryIntent.SUMMARY_SINGLE) {
            return this.retrieveSingleDocumentSummary(userId, normalizedQuery);
        }

        if (intent === QueryIntent.SUMMARY_ALL) {
            return this.retrieveAllDocumentsSummary(userId, normalizedQuery);
        }

        const vectorValue = await this.createVectorValue(normalizedQuery);

        const candidates = await this.findSemanticCandidates(
            userId,
            vectorValue,
        );

        const relevantCandidates = candidates.filter(
            (candidate) => candidate.similarity >= MIN_SIMILARITY,
        );

        if (relevantCandidates.length === 0) {
            return {
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            };
        }

        const rankedDocuments = this.rankDocuments(relevantCandidates);

        const results = this.selectContextByIntent(intent, rankedDocuments);

        if (results.length === 0) {
            return {
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            };
        }

        return {
            status: 'FOUND',
            results,
        };
    }

    async findRelevantChunks(
        userId: string,
        query: string,
    ): Promise<SearchResult[]> {
        const vectorValue = await this.createVectorValue(query);

        const candidates = await this.findSemanticCandidates(
            userId,
            vectorValue,
        );

        return candidates
            .filter((candidate) => candidate.similarity >= MIN_SIMILARITY)
            .slice(0, FACTUAL_CONTEXT_LIMIT);
    }

    async search(userId: string, query: string) {
        const normalizedQuery = query.trim();

        const availability = await this.getAvailability(userId);

        if (availability.searchableChunkCount === 0) {
            return {
                query: normalizedQuery,
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            };
        }

        const retrieval = await this.retrieveForChat(userId, normalizedQuery);

        return {
            query: normalizedQuery,
            status: retrieval.status,
            results: retrieval.results,
        };
    }

    async getAvailability(userId: string): Promise<SearchAvailability> {
        const [availability] = await this.prisma.$queryRaw<
            SearchAvailability[]
        >`
                SELECT
                    COUNT(
                        DISTINCT document.id
                    )::int
                        AS "documentCount",

                    COUNT(
                        DISTINCT document.id
                    )
                    FILTER (
                        WHERE
                            document.status =
                            'READY'
                    )::int
                        AS "readyDocumentCount",

                    COUNT(chunk.id)
                    FILTER (
                        WHERE
                            document.status =
                            'READY'
                            AND chunk.embedding
                                IS NOT NULL
                    )::int
                        AS "searchableChunkCount"

                FROM documents AS document

                LEFT JOIN
                    document_chunks AS chunk
                    ON chunk.document_id =
                       document.id

                WHERE
                    document.user_id =
                    ${userId}
            `;

        return (
            availability ?? {
                documentCount: 0,
                readyDocumentCount: 0,
                searchableChunkCount: 0,
            }
        );
    }

    private async findSemanticCandidates(
        userId: string,
        vectorValue: string,
    ): Promise<SearchResult[]> {
        const results = await this.prisma.$queryRaw<SearchRow[]>`
                SELECT
                    chunk.id
                        AS "chunkId",

                    document.id
                        AS "documentId",

                    document.name
                        AS "documentName",

                    chunk.page_number
                        AS "pageNumber",

                    chunk.chunk_index
                        AS "chunkIndex",

                    chunk.content
                        AS "content",

                    1 - (
                        chunk.embedding <=>
                        ${vectorValue}::vector
                    ) AS "similarity"

                FROM document_chunks AS chunk

                INNER JOIN documents AS document
                    ON document.id =
                       chunk.document_id

                WHERE
                    document.user_id =
                        ${userId}

                    AND document.status =
                        'READY'

                    AND chunk.embedding
                        IS NOT NULL

                ORDER BY
                    chunk.embedding <=>
                    ${vectorValue}::vector

                LIMIT ${CANDIDATE_LIMIT}
            `;

        return this.normalizeResults(results);
    }

    private rankDocuments(results: SearchResult[]): RankedDocument[] {
        const groups = new Map<
            string,
            {
                documentId: string;
                documentName: string;
                chunks: SearchResult[];
            }
        >();

        for (const result of results) {
            const existingGroup = groups.get(result.documentId);

            if (existingGroup) {
                existingGroup.chunks.push(result);

                continue;
            }

            groups.set(result.documentId, {
                documentId: result.documentId,
                documentName: result.documentName,
                chunks: [result],
            });
        }

        return Array.from(groups.values())
            .map((group) => {
                const sortedChunks = [...group.chunks].sort(
                    (first, second) => second.similarity - first.similarity,
                );

                const topChunks = sortedChunks.slice(0, 3);

                const maximumSimilarity = topChunks[0]?.similarity ?? 0;

                const averageSimilarity =
                    topChunks.reduce(
                        (sum, chunk) => sum + chunk.similarity,
                        0,
                    ) / topChunks.length;

                /*
                 * A document should not win
                 * because of only one accidental
                 * chunk match.
                 */
                const score =
                    maximumSimilarity * 0.65 + averageSimilarity * 0.35;

                return {
                    documentId: group.documentId,
                    documentName: group.documentName,
                    score: Number(score.toFixed(4)),
                    chunks: sortedChunks,
                };
            })
            .sort((first, second) => second.score - first.score);
    }

    private selectContextByIntent(
        intent: QueryIntent,
        documents: RankedDocument[],
    ): SearchResult[] {
        if (documents.length === 0) {
            return [];
        }

        if (intent === QueryIntent.COMPARISON) {
            return documents
                .slice(0, 2)
                .flatMap((document) =>
                    document.chunks.slice(0, COMPARISON_CHUNKS_PER_DOCUMENT),
                );
        }

        if (intent === QueryIntent.EXHAUSTIVE) {
            const bestDocumentScore = documents[0].score;

            return documents
                .filter(
                    (document) =>
                        document.score >=
                        bestDocumentScore - DOCUMENT_SCORE_MARGIN,
                )
                .slice(0, MAX_SELECTED_DOCUMENTS)
                .flatMap((document) =>
                    document.chunks.slice(0, EXHAUSTIVE_CHUNKS_PER_DOCUMENT),
                )
                .slice(0, EXHAUSTIVE_CONTEXT_LIMIT);
        }

        /*
         * FACTUAL:
         * use only the best-ranked document.
         * This prevents invoice chunks from
         * contaminating questions about a CV.
         */
        return documents[0].chunks.slice(0, FACTUAL_CONTEXT_LIMIT);
    }

    private async retrieveSingleDocumentSummary(
        userId: string,
        query: string,
    ): Promise<ChatRetrievalResult> {
        const documents = await this.getReadyDocuments(userId);

        if (documents.length === 0) {
            return {
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            };
        }

        const selectedDocument = this.resolveSummaryDocument(query, documents);

        if (!selectedDocument) {
            return {
                status: 'DOCUMENT_SELECTION_REQUIRED',
                results: [],
            };
        }

        const vectorValue = await this.createVectorValue(query);

        const results = await this.findOrderedChunks(
            userId,
            selectedDocument.id,
            vectorValue,
            SINGLE_SUMMARY_CHUNK_LIMIT,
        );

        if (results.length === 0) {
            return {
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            };
        }

        return {
            status: 'FOUND',
            results,
        };
    }

    private async retrieveAllDocumentsSummary(
        userId: string,
        query: string,
    ): Promise<ChatRetrievalResult> {
        const documents = await this.getReadyDocuments(userId);

        if (documents.length === 0) {
            return {
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            };
        }

        if (documents.length > MAX_SUMMARY_DOCUMENTS) {
            return {
                status: 'DOCUMENT_SELECTION_REQUIRED',
                results: [],
            };
        }

        const vectorValue = await this.createVectorValue(query);

        const chunksByDocument = await Promise.all(
            documents.map((document) =>
                this.findOrderedChunks(
                    userId,
                    document.id,
                    vectorValue,
                    SUMMARY_CHUNKS_PER_DOCUMENT,
                ),
            ),
        );

        const results = chunksByDocument.flat();

        if (results.length === 0) {
            return {
                status: 'NO_RELEVANT_CONTEXT',
                results: [],
            };
        }

        return {
            status: 'FOUND',
            results,
        };
    }

    private async findOrderedChunks(
        userId: string,
        documentId: string,
        vectorValue: string,
        limit: number,
    ): Promise<SearchResult[]> {
        const results = await this.prisma.$queryRaw<SearchRow[]>`
                SELECT
                    chunk.id
                        AS "chunkId",

                    document.id
                        AS "documentId",

                    document.name
                        AS "documentName",

                    chunk.page_number
                        AS "pageNumber",

                    chunk.chunk_index
                        AS "chunkIndex",

                    chunk.content
                        AS "content",

                    1 - (
                        chunk.embedding <=>
                        ${vectorValue}::vector
                    ) AS "similarity"

                FROM document_chunks AS chunk

                INNER JOIN documents AS document
                    ON document.id =
                       chunk.document_id

                WHERE
                    document.id =
                        ${documentId}

                    AND document.user_id =
                        ${userId}

                    AND document.status =
                        'READY'

                    AND chunk.embedding
                        IS NOT NULL

                ORDER BY
                    chunk.chunk_index ASC

                LIMIT ${limit}
            `;

        return this.normalizeResults(results);
    }

    private async getReadyDocuments(userId: string): Promise<ReadyDocument[]> {
        return this.prisma.document.findMany({
            where: {
                userId,
                status: 'READY',
                chunkCount: {
                    gt: 0,
                },
            },
            select: {
                id: true,
                name: true,
                chunkCount: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    private resolveSummaryDocument(
        query: string,
        documents: ReadyDocument[],
    ): ReadyDocument | null {
        if (documents.length === 1) {
            return documents[0];
        }

        const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();

        return (
            documents.find((document) => {
                const fullName = document.name.toLowerCase().trim();

                const nameWithoutExtension = fullName
                    .replace(/\.pdf$/i, '')
                    .trim();

                return (
                    normalizedQuery.includes(fullName) ||
                    (nameWithoutExtension.length >= 5 &&
                        normalizedQuery.includes(nameWithoutExtension))
                );
            }) ?? null
        );
    }

    private async createVectorValue(query: string): Promise<string> {
        const embedding = await this.embeddingsService.createOne(query.trim());

        return `[${embedding.join(',')}]`;
    }

    private normalizeResults(results: SearchRow[]): SearchResult[] {
        return results.map((result) => ({
            ...result,
            similarity: Number(Number(result.similarity).toFixed(4)),
        }));
    }
}
