const SENSITIVE_LINE_PATTERNS = [
    /^\s*(?:(?:contractor|customer|billing|residential|home|mailing|bank)\s+)?address\s*:/i,

    /^\s*(?:tax\s+code|tax\s+id|tin|vat)\b/i,

    /^\s*(?:bank\s+name|intermediary\s+bank|correspondent\s+bank)\s*:/i,

    /^\s*(?:bank\s+)?account(?:\s+number)?\s*:/i,

    /^\s*(?:iban|swift|bic|routing\s+number|sort\s+code)\s*:/i,

    /^\s*postal\s+code\s*:/i,
];

const STREET_ADDRESS_PATTERN =
    /(?:\b(?:street|avenue|road|boulevard|apartment|suite)\b|\b(?:str|st|ave|rd|blvd|apt|ul|lok)\.|\b\d{2}-\d{3}\b)/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const URL_PATTERN = /https?:\/\/[^\s]+/gi;

const PHONE_PATTERN =
    /(?:\+\d{1,3}(?:[\s().-]*\d){7,14}|\b\d{1,3}(?:[\s()-]+\d{2,4}){2,5}\b)/g;

const LONG_NUMBER_PATTERN = /\b\d{12,19}\b/g;

function truncateExcerpt(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
        return content;
    }

    let truncated = content.slice(0, maxLength);

    const lastOpenBracket = truncated.lastIndexOf('[');

    const lastCloseBracket = truncated.lastIndexOf(']');

    if (lastOpenBracket > lastCloseBracket) {
        truncated = truncated.slice(0, lastOpenBracket);
    }

    const lastBoundary = Math.max(
        truncated.lastIndexOf('\n'),
        truncated.lastIndexOf(' '),
    );

    if (lastBoundary > 0) {
        truncated = truncated.slice(0, lastBoundary);
    }

    return `${truncated.trim()}…`;
}

export function sanitizeSourceExcerpt(
    content: string,
    maxLength = 300,
): string {
    const sanitized = content
        .split(/\r?\n/)
        .filter((line) => {
            const containsSensitiveLabel = SENSITIVE_LINE_PATTERNS.some(
                (pattern) => pattern.test(line),
            );

            const containsStreetAddress = STREET_ADDRESS_PATTERN.test(line);

            return !containsSensitiveLabel && !containsStreetAddress;
        })
        .join('\n')
        .replace(EMAIL_PATTERN, '[email redacted]')
        .replace(URL_PATTERN, '[link redacted]')
        .replace(PHONE_PATTERN, '[phone redacted]')
        .replace(LONG_NUMBER_PATTERN, '[number redacted]')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return truncateExcerpt(sanitized, maxLength);
}
