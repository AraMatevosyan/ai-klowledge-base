import {
    extractCitedSourceNumbers,
    filterCitedSources,
} from './citation.utils';

describe('citation.utils', () => {
    describe('extractCitedSourceNumbers', () => {
        it('extracts individual citations', () => {
            const result = extractCitedSourceNumbers(
                'Answer from [1], [2] and [3].',
            );

            expect(Array.from(result)).toEqual([1, 2, 3]);
        });

        it('extracts adjacent citations', () => {
            const result = extractCitedSourceNumbers('Answer [2][3].');

            expect(Array.from(result)).toEqual([2, 3]);
        });

        it('extracts comma-separated citations', () => {
            const result = extractCitedSourceNumbers('Answer [1, 3, 5].');

            expect(Array.from(result)).toEqual([1, 3, 5]);
        });

        it('expands citation ranges', () => {
            const result = extractCitedSourceNumbers('Answer [2-4] and [6–7].');

            expect(Array.from(result)).toEqual([2, 3, 4, 6, 7]);
        });

        it('removes duplicate citations', () => {
            const result = extractCitedSourceNumbers('Answer [1] [1] [2].');

            expect(Array.from(result)).toEqual([1, 2]);
        });

        it('ignores malformed citations', () => {
            const result = extractCitedSourceNumbers(
                'Answer [source 1] and [].',
            );

            expect(result.size).toBe(0);
        });
    });

    describe('filterCitedSources', () => {
        const sources = [
            {
                sourceNumber: 1,
                content: 'First source',
            },
            {
                sourceNumber: 2,
                content: 'Second source',
            },
            {
                sourceNumber: 3,
                content: 'Third source',
            },
        ];

        it('returns only cited sources', () => {
            const result = filterCitedSources('Answer [1][3].', sources);

            expect(result).toEqual([sources[0], sources[2]]);
        });

        it('returns an empty array when answer has no citations', () => {
            const result = filterCitedSources(
                'Answer without citations.',
                sources,
            );

            expect(result).toEqual([]);
        });

        it('does not renumber sources', () => {
            const result = filterCitedSources('Answer [3].', sources);

            expect(result).toEqual([
                {
                    sourceNumber: 3,
                    content: 'Third source',
                },
            ]);
        });
    });
});
