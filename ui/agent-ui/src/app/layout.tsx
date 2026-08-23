import type { Metadata } from "next";

import { AuthProvider } from "@/context/Authcontext";

import "./globals.css";

export const metadata: Metadata = {
    title: "OpenG2P Agent Portal",
    description: "Issue printable verifiable credentials to beneficiaries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
