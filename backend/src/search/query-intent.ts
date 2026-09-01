export enum QueryIntent {
    FACTUAL = 'FACTUAL',
    SUMMARY_SINGLE = 'SUMMARY_SINGLE',
    SUMMARY_ALL = 'SUMMARY_ALL',
    EXHAUSTIVE = 'EXHAUSTIVE',
    COMPARISON = 'COMPARISON',
}

const SUMMARY_PATTERNS = [
    // English
    /\bsummari[sz]e\b/i,
    /\bsummary\b/i,
    /\boverview\b/i,
    /\bmain topics?\b/i,
    /\bmain ideas?\b/i,
    /\bmain subjects?\b/i,
    /\bmain points?\b/i,
    /\bkey points?\b/i,
    /\bkey takeaways?\b/i,
    /\bwhat (?:is|are) (?:this|the|these) documents?(?: about)?[?.!]*$/i,
    /\bwhat kind of document\b/i,
    /\bdescribe (?:this|the|these) documents?\b/i,

    // Russian
    /(?:резюмируй|суммаризируй|обобщи)/iu,
    /краткое\s+содержание/iu,
    /кратко\s+(?:опиши|расскажи)/iu,
    /(?:основные|главные|ключевые)\s+(?:пункты|темы|мысли)/iu,
    /о\s+ч[её]м\s+(?:(?:этот|данный|эти)\s+)?документ(?:ы)?/iu,
    /что\s+(?:это\s+)?за\s+документ(?:ы)?/iu,
    /(?:опиши|расскажи\s+про)\s+(?:(?:этот|данный|эти)\s+)?документ(?:ы)?/iu,
];

const ALL_DOCUMENTS_PATTERNS = [
    // English
    /\ball (?:my )?(?:uploaded )?(?:documents?|files?)\b/i,
    /\bevery (?:document|file)\b/i,
    /\beach (?:document|file)\b/i,
    /\bacross (?:all |my |the |these )?(?:uploaded )?(?:documents|files)\b/i,
    /\bfrom (?:all |my |the |these )?(?:uploaded )?(?:documents|files)\b/i,
    /\b(?:my|the|these) (?:uploaded )?(?:documents|files)\b/i,
    /\bentire knowledge base\b/i,

    // Russian
    /все\s+(?:мои\s+)?(?:загруженные\s+)?документы/iu,
    /кажд(?:ый|ого|ом)\s+(?:загруженн(?:ый|ого|ом)\s+)?документ/iu,
    /во\s+всех\s+(?:загруженных\s+)?документах/iu,
    /из\s+всех\s+(?:загруженных\s+)?документов/iu,
    /по\s+всем\s+(?:загруженным\s+)?документам/iu,
    /(?:мои|эти)\s+(?:загруженные\s+)?документы/iu,
    /в\s+(?:моих|этих)\s+(?:загруженных\s+)?документах/iu,
    /что\s+(?:это\s+)?за\s+документы/iu,
    /вс[юе]\s+баз[уе]\s+знаний/iu,
];

const COMPARISON_PATTERNS = [
    // English
    /\bcompare\b/i,
    /\bcomparison\b/i,
    /\bdifferences? between\b/i,
    /\bversus\b/i,
    /\bvs\.?\b/i,

    // Russian
    /сравни(?:ть|те|вай(?:те)?)?/iu,
    /сравнение/iu,
    /разниц[аы]\s+между/iu,
    /различия\s+между/iu,
    /отличия\s+между/iu,
];

const EXHAUSTIVE_PATTERNS = [
    // English
    /\blist all\b/i,
    /\blist every\b/i,
    /\bcomplete list\b/i,
    /\bentire work history\b/i,
    /\bentire professional experience\b/i,
    /\bwhich (?:companies|employers|technologies|skills|projects|tools|frameworks|databases)\b/i,
    /\bwhat (?:companies|employers|technologies|skills|projects|tools|frameworks|databases)\b/i,
    /\ball (?:companies|employers|technologies|skills|projects|tools|frameworks|databases)\b/i,

    // Russian
    /перечисли\s+все/iu,
    /полный\s+список/iu,
    /вся\s+история\s+работы/iu,
    /весь\s+профессиональный\s+опыт/iu,
    /какие\s+(?:компании|работодатели|технологии|навыки|проекты|инструменты|фреймворки|базы\s+данных)/iu,
    /все\s+(?:компании|работодатели|технологии|навыки|проекты|инструменты|фреймворки|базы\s+данных)/iu,
];

function matchesAnyPattern(query: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(query));
}

export function detectQueryIntentByPatterns(query: string): QueryIntent | null {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ');

    if (!normalizedQuery) {
        return null;
    }

    if (matchesAnyPattern(normalizedQuery, COMPARISON_PATTERNS)) {
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

    return null;
}

/**
 * Backward-compatible detector.
 *
 * QueryIntentClassifierService will later use
 * detectQueryIntentByPatterns() and invoke the AI classifier
 * when it returns null.
 */
export function detectQueryIntent(query: string): QueryIntent {
    return detectQueryIntentByPatterns(query) ?? QueryIntent.FACTUAL;
}
