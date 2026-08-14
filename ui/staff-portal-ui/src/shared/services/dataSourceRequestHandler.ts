"use client";

import { toast } from "react-toastify";
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

        const data = await response.json().catch(() => null);

        if (!response.ok || data?.response_header?.response_status === 'ERROR') {
            const errorMessage =
                data?.statusText ||
                data?.errors?.[0]?.message ||
                data?.response_header?.response_error_message ||
                response.statusText ||
                'There was an issue fetching data. Please try again.';
            const code = data?.code || data?.errors?.[0]?.code;
            toast.error(code ? `${code} - ${errorMessage}` : errorMessage, {
                position: 'top-right',
                autoClose: 6000,
            });
            return null;
        }

        if (data?.response_body?.response_payload !== undefined) {
            return data.response_body.response_payload;
        }

        return data;
    } catch (error) {
        toast.error(error instanceof Error ? error.message : 'There was an issue fetching data. Please try again.', {
            position: 'top-right',
            autoClose: 6000,
        });
        return null;
    }
};
