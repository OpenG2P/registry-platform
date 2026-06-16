import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
    output: "standalone",
    reactCompiler: true,
    webpack: (config: any, { dev }: any) => {
        // Keep existing dev watch options for better hot reloading
        if (dev) {
            config.watchOptions = {
                poll: 1000,
                aggregateTimeout: 300,
            };
        }

        // Silence noisy third‑party warnings 
        config.ignoreWarnings = [
            ...(config.ignoreWarnings || []),
            {
                module: /inji-sdk[\\/]dist[\\/]index\.js/,
                message: /Critical dependency: the request of a dependency is an expression/,
            },
        ];

        return config;
    },
};

export default withNextIntl(nextConfig);
