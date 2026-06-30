import { getServerEnv, type ServerEnv } from "@/app/api/_lib/env-config";

type CspSrcEnvKey = Extract<keyof ServerEnv, `cspSrc${string}`>;
type CspRule = readonly [directive: string, envKey: CspSrcEnvKey, defaults: readonly string[]];

const CSP_RULES: CspRule[] = [
    ["default-src", "cspSrcDefault", ["'self'"]],
    ["script-src", "cspSrcScript", ["'self'", "'unsafe-inline'"]],
    ["style-src", "cspSrcStyle", ["'self'", "'unsafe-inline'"]],
    ["img-src", "cspSrcImg", ["'self'", "blob:", "data:"]],
    ["font-src", "cspSrcFont", ["'self'"]],
    ["connect-src", "cspSrcConnect", ["'self'"]],
    ["frame-src", "cspSrcFrame", ["'self'"]],
    ["object-src", "cspSrcObject", ["'none'"]],
    ["base-uri", "cspSrcBaseUri", ["'self'"]],
    ["form-action", "cspSrcFormAction", ["'self'"]],
    ["frame-ancestors", "cspSrcFrameAncestors", ["'none'"]],
];

const QUOTED_KEYWORDS = new Set(["self", "unsafe-inline", "unsafe-eval", "none", "strict-dynamic"]);

function formatSource(source: string): string {
    const bare = source.replace(/^['"]|['"]$/g, "");

    return QUOTED_KEYWORDS.has(bare) ? `'${bare}'` : bare;
}

function resolveSources(value: string | undefined, defaults: readonly string[]): string[] {
    return value ? value.split(/\s+/).map(formatSource) : [...defaults];
}

// CSP_HEADER — full policy override. CSP_SRC_* — per-directive override (space-separated).
export function buildCspHeader(env = getServerEnv()): string {
    if (env.cspHeader) {
        return env.cspHeader;
    }

    const directives = CSP_RULES.map(
        ([directive, envKey, defaults]) =>
            `${directive} ${resolveSources(env[envKey], defaults).join(" ")}`
    );

    return `${directives.join("; ")};`;
}
