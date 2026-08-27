const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);

        this.name = 'ApiError';
    }
}

export async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const isFormData =
        typeof FormData !== 'undefined' && options.body instanceof FormData;

    const headers = new Headers(options.headers);

    if (options.body && !isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
    });

    const responseText = await response.text();

    let data: unknown = null;

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            data = responseText;
        }
    }

    if (!response.ok) {
        const rawMessage =
            data && typeof data === 'object' && 'message' in data
                ? data.message
                : null;

        const message = Array.isArray(rawMessage)
            ? rawMessage.join(', ')
            : typeof rawMessage === 'string'
              ? rawMessage
              : typeof data === 'string'
                ? data
                : 'An unexpected error occurred';

        throw new ApiError(message, response.status);
    }

    return data as T;
}
