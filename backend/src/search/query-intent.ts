export enum QueryIntent {
    FACTUAL = 'FACTUAL',
    SUMMARY_SINGLE = 'SUMMARY_SINGLE',
    SUMMARY_ALL = 'SUMMARY_ALL',
    EXHAUSTIVE = 'EXHAUSTIVE',
    COMPARISON = 'COMPARISON',
}

const SUMMARY_PATTERNS = [
    /\bsummari[sz]e\b/i,
    /\bsummary\b/i,
    /\boverview\b/i,
    /\bmain topics?\b/i,
    /\bmain ideas?\b/i,
    /\bmain subjects?\b/i,
    /\bmain points?\b/i,
    /\bkey points?\b/i,
    /\bkey takeaways?\b/i,
    /\bwhat (?:is|are) (?:this|the|these) documents? about\b/i,
    /\bdescribe (?:this|the|these) documents?\b/i,
];

const ALL_DOCUMENTS_PATTERNS = [
    /\ball (?:my )?(?:uploaded )?(?:documents?|files?)\b/i,
    /\bevery (?:document|file)\b/i,
    /\beach (?:document|file)\b/i,
    /\bacross (?:all |my |the |these )?(?:uploaded )?(?:documents|files)\b/i,
    /\bfrom (?:all |my |the |these )?(?:uploaded )?(?:documents|files)\b/i,
    /\b(?:my|these) (?:uploaded )?(?:documents|files)\b/i,
    /\bentire knowledge base\b/i,
];

const COMPARISON_PATTERNS = [
    /\bcompare\b/i,
    /\bcomparison\b/i,
    /\bdifference between\b/i,
    /\bdifferences between\b/i,
    /\bversus\b/i,
    /\bvs\.?\b/i,
];

const EXHAUSTIVE_PATTERNS = [
    /\blist all\b/i,
    /\blist every\b/i,
    /\bcomplete list\b/i,
    /\bentire work history\b/i,
    /\bentire professional experience\b/i,

    /\bwhich (companies|employers|technologies|skills|projects|tools|frameworks|databases)\b/i,

    /\bwhat (companies|employers|technologies|skills|projects|tools|frameworks|databases)\b/i,

    /\ball (companies|employers|technologies|skills|projects|tools|frameworks|databases)\b/i,
];

function matchesAnyPattern(query: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(query));
}

export function detectQueryIntent(query: string): QueryIntent {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    const isComparison = matchesAnyPattern(
        normalizedQuery,
        COMPARISON_PATTERNS,
    );

    if (isComparison) {
        return QueryIntent.COMPARISON;
    }

    const isSummary = matchesAnyPattern(normalizedQuery, SUMMARY_PATTERNS);

    const targetsAllDocuments = matchesAnyPattern(
        normalizedQuery,
        ALL_DOCUMENTS_PATTERNS,
    );

    if (isSummary && targetsAllDocuments) {
        return QueryIntent.SUMMARY_ALL;
    }

    if (isSummary) {
        return QueryIntent.SUMMARY_SINGLE;
    }

    const isExhaustive =
        targetsAllDocuments ||
        matchesAnyPattern(normalizedQuery, EXHAUSTIVE_PATTERNS);

    if (isExhaustive) {
        return QueryIntent.EXHAUSTIVE;
    }

    return QueryIntent.FACTUAL;
}
