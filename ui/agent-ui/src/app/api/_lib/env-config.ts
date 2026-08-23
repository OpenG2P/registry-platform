// Single source of server/runtime env — read at request time (K8s pod env, not
// Docker build), exactly as the staff portal does.
export function getServerEnv() {
    return {
        // The Agent Portal API (registry side) this BFF proxies to.
        backendApiUrl: process.env.BACKEND_API_URL ?? "",
        // iam-agent-portal-api. It is the OIDC confidential client: it holds the
        // client secret, exchanges the code and owns the session.
        iamUrl: process.env.IAM_URL ?? "",
        // Row id in IAM's login_providers for the agent realm.
        loginProviderId: process.env.LOGIN_PROVIDER_ID ?? "",
        applicationMnemonic: process.env.APPLICATION_MNEMONIC ?? "openg2p-registry-agent",
        cookieDomain: process.env.COOKIE_DOMAIN?.trim() ?? "",
    };
}

export type ServerEnv = ReturnType<typeof getServerEnv>;
