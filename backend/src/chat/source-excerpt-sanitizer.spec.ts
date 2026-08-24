import { sanitizeSourceExcerpt } from './source-excerpt-sanitizer';

describe('sanitizeSourceExcerpt', () => {
    it('removes sensitive invoice fields', () => {
        const content = `
Contractor:
Example Contractor
Contractor Address: Example street 10
TAX CODE: 123456789
Bank account number: 1234567890123456
Swift: EXAMPLE22
Bank name: Example Bank
Bank address: Example road 20
Intermediary bank: Another Bank
Customer:
Example Customer LLC
ul. Example 8, 02-685, Example City
VAT PL1234567890
Total amount payable: 700 EUR
        `.trim();

        const result = sanitizeSourceExcerpt(content);

        expect(result).toContain('Example Contractor');

        expect(result).toContain('Example Customer LLC');

        expect(result).toContain('Total amount payable: 700 EUR');

        expect(result).not.toContain('Example street');

        expect(result).not.toContain('Example road');

        expect(result).not.toContain('123456789');

        expect(result).not.toContain('Example Bank');

        expect(result).not.toContain('VAT PL');
    });

    it('redacts contact information', () => {
        const content = `
Frontend Engineer
+1 555 123 4567
developer@example.com
https://example.com/profile
React and TypeScript
        `.trim();

        const result = sanitizeSourceExcerpt(content);

        expect(result).toContain('[phone redacted]');

        expect(result).toContain('[email redacted]');

        expect(result).toContain('[link redacted]');

        expect(result).toContain('React and TypeScript');

        expect(result).not.toContain('developer@example.com');
    });

    it('preserves non-sensitive content', () => {
        const content = `
Frontend Engineer with 6+ years of experience.
Technologies: React, TypeScript, Next.js.
        `.trim();

        expect(sanitizeSourceExcerpt(content)).toBe(content);
    });

    it('does not cut a redaction placeholder', () => {
        const content =
            `${'A'.repeat(70)} ` + '+1 555 123 4567 additional text';

        const result = sanitizeSourceExcerpt(content, 85);

        expect(result).toMatch(/…$/);

        expect(result).not.toMatch(/\[[^\]]*$/);
    });
});
