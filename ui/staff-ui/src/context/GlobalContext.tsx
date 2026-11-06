"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/context/Authcontext";
import { RbacProvider } from "@/context/RbacContext";

export const GlobalContextProvider = ({ children }: { children: ReactNode }) => {
    return (
        <AuthProvider>
            <RbacProvider>
                {children}
            </RbacProvider>
        </AuthProvider>
    );
};
