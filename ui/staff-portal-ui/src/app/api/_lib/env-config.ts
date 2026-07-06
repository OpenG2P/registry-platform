// Single source of server/runtime env — read at request time (K8s pod env, not Docker build).
export function getServerEnv() {
    return {
        backendApiUrl: process.env.BACKEND_API_URL ?? "",
        masterdataBackendApiUrl: process.env.MASTERDATA_BACKEND_API_URL ?? "",
        iamUrl: process.env.IAM_URL ?? "",
        loginProviderId: process.env.LOGIN_PROVIDER_ID ?? "",
        applicationMnemonic: process.env.APPLICATION_MNEMONIC ?? "openg2p-registry",
        cookieDomain: process.env.COOKIE_DOMAIN?.trim() ?? "",

        defaultLocale: process.env.DEFAULT_LOCALE ?? "",

        partnerImportExportEnable: process.env.PARTNER_IMPORT_EXPORT_ENABLE === "true",
        verifyServiceUrl: process.env.VERIFY_SERVICE_URL ?? "",
        vpClientId: process.env.VP_CLIENT_ID ?? "",
        pageSize: parseInt(process.env.PAGE_SIZE ?? "10", 10),

        cspHeader: process.env.CSP_HEADER?.trim() ?? "",
        cspSrcDefault: process.env.CSP_SRC_DEFAULT?.trim(),
        cspSrcScript: process.env.CSP_SRC_SCRIPT?.trim(),
        cspSrcStyle: process.env.CSP_SRC_STYLE?.trim(),
        cspSrcImg: process.env.CSP_SRC_IMG?.trim(),
        cspSrcFont: process.env.CSP_SRC_FONT?.trim(),
        cspSrcConnect: process.env.CSP_SRC_CONNECT?.trim(),
        cspSrcFrame: process.env.CSP_SRC_FRAME?.trim(),
        cspSrcObject: process.env.CSP_SRC_OBJECT?.trim(),
        cspSrcBaseUri: process.env.CSP_SRC_BASE_URI?.trim(),
        cspSrcFormAction: process.env.CSP_SRC_FORM_ACTION?.trim(),
        cspSrcFrameAncestors: process.env.CSP_SRC_FRAME_ANCESTORS?.trim(),
    };
}

export type ServerEnv = ReturnType<typeof getServerEnv>;
