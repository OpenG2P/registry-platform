import { useAuth } from "@/context/Authcontext";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { withCsrfHeaders } from "@/shared/utils/csrf";

interface UseFetchConfig {
    url?: string | null;
    options?: RequestInit;
    enabled?: boolean;
    keepPreviousData?: boolean;
}

export function useFetch<T = any>({
    url = null,
    options,
    enabled = true,
    keepPreviousData = true,
}: UseFetchConfig = {}) {
    const [data, setData] = useState<T | null>(null);
    const dataKeyRef = useRef<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const { handleUnauthorized } = useAuth()

    const controllerRef = useRef<AbortController | null>(null);

    // Memoize options to prevent infinite loops
    const optionsString = useMemo(() => JSON.stringify(options), [options]);

    const reset = useCallback(() => {
        if (controllerRef.current) {
            controllerRef.current.abort();
            controllerRef.current = null;
        }
        dataKeyRef.current = null;
        setData(null);
        setError(null);
        setLoading(false);
    }, []);

    // Manual execute method for on-demand API calls
    const execute = useCallback(async (
        executeUrl?: string,
        executeOptions?: RequestInit
    ): Promise<T | null> => {
        const finalUrl = executeUrl || url;
        const finalOptions = executeOptions || options;

        if (!finalUrl) {
            throw new Error('URL is required for execute');
        }

        if (controllerRef.current) {
            controllerRef.current.abort();
        }

        const controller = new AbortController();
        controllerRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const method = (finalOptions?.method || 'GET').toUpperCase();
            const res = await fetch(finalUrl, {
                ...finalOptions,
                credentials: 'include',
                headers:
                    finalOptions?.body instanceof FormData
                        ? withCsrfHeaders(method, finalOptions?.headers)
                        : withCsrfHeaders(method, {
                            "Content-Type": "application/json",
                            ...(finalOptions?.headers ?? {}),
                        }),
                signal: controller.signal,
            });

            if (controller.signal.aborted) return null;

            if (res.status === 401) {
                handleUnauthorized();
                return null;
            }

            const result = await res.json();
            // Aborting after the body has been read does not reject, so a superseded response would still land here.
            if (controller.signal.aborted) return null;

            if (!res.ok) {
                const errorMessage =
                    (typeof result?.statusText === "string" && result.statusText) ||
                    result?.errors?.[0]?.message ||
                    res.statusText ||
                    "Something went wrong";
                const code = result?.code || result?.errors?.[0]?.code;
                const toastMessage = code ? `${code} - ${errorMessage}` : errorMessage;

                setError(errorMessage);
                toast.error(toastMessage, { position: "top-right", autoClose: 6000 });
                return null;
            }

            dataKeyRef.current = `${finalUrl}|${JSON.stringify(finalOptions)}`;
            setData(result);
            return result;
        } catch (e) {
            if (controller.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) {
                return null;
            }
            const errorMessage = e instanceof Error ? e.message : "Something went wrong";
            setError(errorMessage);
            toast.error(errorMessage, { position: "top-right", autoClose: 6000 });
            return null;
        } finally {
            if (controllerRef.current === controller) {
                setLoading(false);
            }
        }
    }, [url, optionsString]);

    // Auto-fetch using execute
    useEffect(() => {
        if (!url || !enabled) return;

        // Fetch data on mount
        execute(url, options);

        return () => {
            if (controllerRef.current) {
                controllerRef.current.abort();
            }
        };
    }, [url, enabled, optionsString]);

    const isCurrentData = enabled && !!url && dataKeyRef.current === `${url}|${optionsString}`;

    return {
        data: keepPreviousData || isCurrentData ? data : null,
        error,
        loading,
        reset,
        execute,
    };
}
