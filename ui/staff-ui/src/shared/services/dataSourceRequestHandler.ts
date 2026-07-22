"use client";

import { withCsrfHeaders } from '@/shared/utils/csrf';

export type DataSourceRequestHandler = (
    service: string,
    endpoint: string,
    method: string,
    params: Record<string, any>,
    options?: { headers?: Record<string, string> }
) => Promise<any>;

export const dataSourceRequestHandler: DataSourceRequestHandler = async (
    service,
    endpoint,
    method,
    params,
    options,
) => {
    try {
        const url = `/api/${service}/${endpoint}`;
        const requestMethod = method || 'POST';

        const response = await fetch(url, {
            method: requestMethod,
            credentials: 'include',
            headers: withCsrfHeaders(requestMethod, {
                'Content-Type': 'application/json',
                ...options?.headers,
            }),
            body: JSON.stringify(params),
        });

        if (!response.ok) {
            throw new Error('There was an issue fetching data. Please try again.');
        }

        const data = await response.json();

        if (data.response_header?.response_status === 'ERROR') {
            throw new Error('There was an issue fetching data. Please try again.');
        }

        if (data.response_body?.response_payload !== undefined) {
            return data.response_body.response_payload;
        }

        return data;
    } catch (error) {
        throw new Error('There was an issue fetching data. Please try again.');
    }
};
