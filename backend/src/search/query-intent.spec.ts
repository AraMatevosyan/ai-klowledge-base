import { detectQueryIntent, QueryIntent } from './query-intent';

describe('detectQueryIntent', () => {
    it.each([
        {
            query: 'What is the main topic of the document?',
            expected: QueryIntent.SUMMARY_SINGLE,
        },
        {
            query: 'Summarize resume.pdf',
            expected: QueryIntent.SUMMARY_SINGLE,
        },
        {
            query: 'Summarize all uploaded documents.',
            expected: QueryIntent.SUMMARY_ALL,
        },
        {
            query: 'Give me an overview of every document.',
            expected: QueryIntent.SUMMARY_ALL,
        },
        {
            query: 'Compare the resume and the invoice.',
            expected: QueryIntent.COMPARISON,
        },
        {
            query: 'What is the difference between these documents?',
            expected: QueryIntent.COMPARISON,
        },
        {
            query: 'Which companies has Ara worked for?',
            expected: QueryIntent.EXHAUSTIVE,
        },
        {
            query: 'List all technologies used by Ara.',
            expected: QueryIntent.EXHAUSTIVE,
        },
        {
            query: 'How many years of professional experience does Ara have?',
            expected: QueryIntent.FACTUAL,
        },
        {
            query: 'What is the capital of Japan?',
            expected: QueryIntent.FACTUAL,
        },
    ])('returns $expected for "$query"', ({ query, expected }) => {
        expect(detectQueryIntent(query)).toBe(expected);
    });
    it.each([
        'What are the main topics across my documents?',
        'Summarize all uploaded documents.',
        'Give me an overview across these documents.',
        'What are the key takeaways from my uploaded files?',
    ])('detects an all-documents summary: %s', (query) => {
        expect(detectQueryIntent(query)).toBe(QueryIntent.SUMMARY_ALL);
    });

    it.each([
        'What are the main topics in this document?',
        'Summarize this document.',
        'Give me an overview of the document.',
    ])('detects a single-document summary: %s', (query) => {
        expect(detectQueryIntent(query)).toBe(QueryIntent.SUMMARY_SINGLE);
    });
});
