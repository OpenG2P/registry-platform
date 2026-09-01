import type { Metadata } from "next";
import { Roboto, Roboto_Slab } from "next/font/google";

import { AuthProvider } from "@/context/Authcontext";

import "./globals.css";

// Branding mandates Roboto (body) and Roboto Slab (headings). globals.css named
// both from the start but nothing ever loaded them, so every weight fell through
// to the local fallback -- San Francisco for body, Georgia for headings. Loaded
// here the same way the staff portal does it: next/font fetches at BUILD time and
// self-hosts the result, so the running pod never needs to reach fonts.google.com.
const roboto = Roboto({
    weight: ["300", "400", "500", "700"],
    style: ["normal"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-roboto",
});

const robotoSlab = Roboto_Slab({
    weight: ["400", "500", "700"],
    style: ["normal"],
    subsets: ["latin"],
    display: "swap",
    variable: "--font-roboto-slab",
});

export const metadata: Metadata = {
    title: "OpenG2P Agent Portal",
    description: "Issue printable verifiable credentials to beneficiaries.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${roboto.variable} ${robotoSlab.variable}`}>
            <body>
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
