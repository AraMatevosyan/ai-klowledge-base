import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';

export class PdfProcessingError extends Error {
    constructor(
        message: string,
        public readonly originalError?: unknown,
    ) {
        super(message);
        this.name = 'PdfProcessingError';
    }
}

export type ExtractedPdfPage = {
    pageNumber: number;
    text: string;
};

export type ExtractedPdf = {
    pageCount: number;
    pages: ExtractedPdfPage[];
};

@Injectable()
export class PdfProcessorService {
    async extract(buffer: Buffer): Promise<ExtractedPdf> {
        const parser = new PDFParse({
            data: buffer,
        });

        try {
            const result = await parser.getText();

            const pages = result.pages.map((page) => ({
                pageNumber: page.num,
                text: this.normalizeText(page.text),
            }));

            const hasExtractableText = pages.some(
                (page) => page.text.length > 0,
            );

            if (!hasExtractableText) {
                throw new PdfProcessingError(
                    'The PDF does not contain extractable text',
                );
            }

            return {
                pageCount: result.total,
                pages,
            };
        } catch (error) {
            if (error instanceof PdfProcessingError) {
                throw error;
            }

            throw new PdfProcessingError(
                'The PDF is invalid, encrypted, or could not be processed',
                error,
            );
        } finally {
            await parser.destroy();
        }
    }

    private normalizeText(text: string) {
        return text
            .replaceAll(String.fromCharCode(0), '')
            .replace(/\r\n?/g, '\n')
            .replace(/[^\S\n]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}
