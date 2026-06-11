type CspRule = readonly [directive: string, envKey: string, defaults: readonly string[]];

const CSP_RULES: CspRule[] = [
    ['default-src', 'CSP_SRC_DEFAULT', ["'self'"]],
    ['script-src', 'CSP_SRC_SCRIPT', ["'self'", "'unsafe-inline'"]],
    ['style-src', 'CSP_SRC_STYLE', ["'self'", "'unsafe-inline'"]],
    ['img-src', 'CSP_SRC_IMG', ["'self'", 'blob:', 'data:']],
    ['font-src', 'CSP_SRC_FONT', ["'self'"]],
    ['connect-src', 'CSP_SRC_CONNECT', ["'self'"]],
    ['frame-src', 'CSP_SRC_FRAME', ["'self'"]],
    ['object-src', 'CSP_SRC_OBJECT', ["'none'"]],
    ['base-uri', 'CSP_SRC_BASE_URI', ["'self'"]],
    ['form-action', 'CSP_SRC_FORM_ACTION', ["'self'"]],
    ['frame-ancestors', 'CSP_SRC_FRAME_ANCESTORS', ["'none'"]],
];

const QUOTED_KEYWORDS = new Set(['self', 'unsafe-inline', 'unsafe-eval', 'none', 'strict-dynamic']);

function formatSource(source: string): string {
    const bare = source.replace(/^['"]|['"]$/g, '');

    return QUOTED_KEYWORDS.has(bare) ? `'${bare}'` : bare;
}

function resolveSources(envKey: string, defaults: readonly string[]): string[] {
    const value = process.env[envKey]?.trim();

    return value ? value.split(/\s+/).map(formatSource) : [...defaults];
}

// CSP_HEADER — full policy override. CSP_SRC_* — per-directive override (space-separated).
export function buildCspHeader(): string {
    const fullOverride = process.env.CSP_HEADER?.trim();

    if (fullOverride) {
        return fullOverride;
    }

    const directives = CSP_RULES.map(
        ([directive, envKey, defaults]) =>
            `${directive} ${resolveSources(envKey, defaults).join(' ')}`
    );

    return `${directives.join('; ')}; upgrade-insecure-requests`;
}
