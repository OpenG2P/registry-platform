import type { Metadata } from "next";
import { Roboto } from "next/font/google";

import { AuthProvider } from "@/context/Authcontext";

import "./globals.css";

// Roboto, everywhere -- the same single face the staff portal loads, so the two
// portals read as one product rather than two.
//
// globals.css named Roboto and Roboto Slab from the start but nothing ever
// LOADED either, so every weight fell through to the local fallback: San
// Francisco for body and Georgia for headings, neither of them brand fonts.
// Branding does list Roboto Slab as a second face, but staff uses only Roboto
// and a slab serif for headings reads as a different product next to it.
//
// next/font fetches at BUILD time and self-hosts the result, so the running pod
// never needs to reach fonts.google.com.
const roboto = Roboto({
    weight: ["300", "400", "500", "700"],
    style: ["normal"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-roboto",
});

export const metadata: Metadata = {
    title: "OpenG2P Agent Portal",
    description: "Issue printable verifiable credentials to beneficiaries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={roboto.variable}>
            <body>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
