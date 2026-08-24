import { useEffect, useState } from 'react';

const RESIZE_DEBOUNCE_MS = 150;

/**
 * Explicit breakpoint → page size mapping.
 * Evaluated highest-minWidth first; the first match wins.
 *
 * minWidth │ pageSize
 * ─────────┼─────────
 *    1440  │  30
 *    1280  │  20
 *    1024  │  15
 *       0  │  10
 */
const BREAKPOINTS = [
    { minWidth: 1440, pageSize: 30 },
    { minWidth: 1280, pageSize: 20 },
    { minWidth: 1024, pageSize: 15 },
    { minWidth:    0, pageSize: 10 },
] as const;

function resolve(width: number): number {
    return BREAKPOINTS.find((bp) => width >= bp.minWidth)?.pageSize ?? 10;
}

export function usePageSize(): number {
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        const apply = () => setPageSize(resolve(window.innerWidth));
        apply();

        let t: ReturnType<typeof setTimeout>;
        const onResize = () => {
            clearTimeout(t);
            t = setTimeout(apply, RESIZE_DEBOUNCE_MS);
        };

        window.addEventListener('resize', onResize);
        return () => {
            clearTimeout(t);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return pageSize;
}
