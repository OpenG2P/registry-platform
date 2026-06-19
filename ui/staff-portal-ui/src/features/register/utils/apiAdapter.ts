import { withCsrfHeaders } from '@/shared/utils/csrf';

export const apiAdapter = async (url: string, options: any) => {
    const method = options.method || 'GET';
    const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: withCsrfHeaders(method, {
            'Content-Type': 'application/json',
            ...options.headers,
        }),
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
};
