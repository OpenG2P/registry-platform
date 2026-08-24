"use client";

import { createContext, useContext, ReactNode } from "react";
import { Branding, LanguageConfig } from "@/app/api/_lib/client-safe-config.types";

export interface RuntimeConfig {
    verifyServiceUrl: string;
    vpClientId: string;
    registryName: string;
    registryLogo: string;
    registryFavicon: string;
    registry_theme_id: string;
    registry_language_id: string;
    branding?: Branding;
    language_config?: LanguageConfig;
}



interface RuntimeConfigContextType {
    config: RuntimeConfig;
}

const RuntimeConfigContext = createContext<RuntimeConfigContextType | undefined>(
    undefined
);

export function RuntimeConfigProvider({
    children,
    initialConfig
}: {
    children: ReactNode;
    initialConfig: RuntimeConfig;
}) {
    return (
        <RuntimeConfigContext.Provider value={{ config: initialConfig }}>
            {children}
        </RuntimeConfigContext.Provider>
    );
}

export function useRuntimeConfig() {
    const context = useContext(RuntimeConfigContext);
    if (context === undefined) {
        throw new Error(
            "useRuntimeConfig must be used within a RuntimeConfigProvider"
        );
    }
    return context;
}
