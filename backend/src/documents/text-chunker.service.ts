import { Injectable } from '@nestjs/common';

const MAX_CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const MIN_BOUNDARY_RATIO = 0.7;

type PageText = {
    pageNumber: number;
    text: string;
};

export type DocumentChunkInput = {
    pageNumber: number;
    chunkIndex: number;
    content: string;
};

@Injectable()
export class TextChunkerService {
    createChunks(pages: PageText[]): DocumentChunkInput[] {
        const chunks: DocumentChunkInput[] = [];

        let chunkIndex = 0;

        for (const page of pages) {
            const pageChunks = this.splitText(page.text);

            for (const content of pageChunks) {
                chunks.push({
                    pageNumber: page.pageNumber,
                    chunkIndex,
                    content,
                });

                chunkIndex += 1;
            }
        }

        return chunks;
    }

    private splitText(text: string) {
        const normalizedText = text.trim();

        if (!normalizedText) {
            return [];
        }

        const chunks: string[] = [];

        let start = 0;

        while (start < normalizedText.length) {
            const proposedEnd = Math.min(
                start + MAX_CHUNK_SIZE,
                normalizedText.length,
            );

            const end = this.findChunkEnd(normalizedText, start, proposedEnd);

            const content = normalizedText.slice(start, end).trim();

            if (content) {
                chunks.push(content);
            }

            if (end >= normalizedText.length) {
                break;
            }

            start = this.findNextStart(normalizedText, start, end);
        }

        return chunks;
    }

    private findChunkEnd(text: string, start: number, proposedEnd: number) {
        if (proposedEnd >= text.length) {
            return text.length;
        }

        const minimumEnd =
            start + Math.floor(MAX_CHUNK_SIZE * MIN_BOUNDARY_RATIO);

        const searchableText = text.slice(minimumEnd, proposedEnd);

        const boundaries = [
            {
                index: searchableText.lastIndexOf('\n\n'),
                length: 2,
            },
            {
                index: searchableText.lastIndexOf('. '),
                length: 2,
            },
            {
                index: searchableText.lastIndexOf('\n'),
                length: 1,
            },
            {
                index: searchableText.lastIndexOf(' '),
                length: 1,
            },
        ];

        const bestBoundary = boundaries.reduce(
            (best, current) => (current.index > best.index ? current : best),
            {
                index: -1,
                length: 0,
            },
        );

        if (bestBoundary.index === -1) {
            return proposedEnd;
        }

        return minimumEnd + bestBoundary.index + bestBoundary.length;
    }

    private findNextStart(
        text: string,
        previousStart: number,
        currentEnd: number,
    ) {
        const overlapStart = Math.max(
            previousStart + 1,
            currentEnd - CHUNK_OVERLAP,
        );

        const nextWhitespace = text.indexOf(' ', overlapStart);

        if (nextWhitespace !== -1 && nextWhitespace < currentEnd) {
            return nextWhitespace + 1;
        }

        return overlapStart;
    }
}
