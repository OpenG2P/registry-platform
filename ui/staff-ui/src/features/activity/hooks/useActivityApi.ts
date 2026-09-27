"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/Authcontext";
import { withCsrfHeaders } from "@/shared/utils/csrf";
import type { PageInfo, Pagination } from "../types";

export class ActivityApiError extends Error {
    constructor(message: string, public code?: string | number) {
        super(message);
    }
}

export interface ActivityApiResult<T> {
    data: T;
    pagination: PageInfo | null;
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** Calls /api/activity/<action>; throws ActivityApiError with the backend's message. */
export function useActivityApi() {
    const { handleUnauthorized } = useAuth();

    return useCallback(async <T = unknown>(
        action: string,
        payload: Record<string, unknown> = {},
        pagination?: Pagination,
    ): Promise<ActivityApiResult<T>> => {
        const res = await fetch(`/api/activity/${action}`, {
            method: "POST",
            credentials: "include",
            headers: withCsrfHeaders("POST", { "Content-Type": "application/json" }),
            body: JSON.stringify({ payload, pagination }),
        });
        if (res.status === 401) {
            handleUnauthorized();
            throw new ActivityApiError("Your session has expired", 401);
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new ActivityApiError(body?.statusText || res.statusText || "Request failed", body?.code);
        }
        return body as ActivityApiResult<T>;
    }, [handleUnauthorized]);
}
