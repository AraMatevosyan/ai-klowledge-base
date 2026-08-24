type NumberedSource = {
    sourceNumber: number;
};

export function extractCitedSourceNumbers(answer: string): Set<number> {
    const sourceNumbers = new Set<number>();

    const citationPattern = /\[([\d\s,–—-]+)\]/g;

    let match: RegExpExecArray | null;

    while ((match = citationPattern.exec(answer)) !== null) {
        const citationContent = match[1];

        const parts = citationContent.split(',');

        for (const part of parts) {
            const normalizedPart = part.trim();

            const rangeMatch = normalizedPart.match(/^(\d+)\s*[–—-]\s*(\d+)$/);

            if (rangeMatch) {
                const start = Number(rangeMatch[1]);

                const end = Number(rangeMatch[2]);

                const first = Math.min(start, end);

                const last = Math.max(start, end);

                // Prevent unexpectedly large ranges.
                if (last - first > 20) {
                    continue;
                }

                for (
                    let sourceNumber = first;
                    sourceNumber <= last;
                    sourceNumber += 1
                ) {
                    sourceNumbers.add(sourceNumber);
                }

                continue;
            }

            const sourceNumber = Number(normalizedPart);

            if (Number.isInteger(sourceNumber) && sourceNumber > 0) {
                sourceNumbers.add(sourceNumber);
            }
        }
    }

    return sourceNumbers;
}

export function filterCitedSources<T extends NumberedSource>(
    answer: string,
    sources: T[],
): T[] {
    const citedSourceNumbers = extractCitedSourceNumbers(answer);

    return sources.filter((source) =>
        citedSourceNumbers.has(source.sourceNumber),
    );
}
