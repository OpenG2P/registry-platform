import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Same as the staff portal: a standalone server bundle, so the runtime
    // image is `node server.js` rather than a static bundle behind nginx.
    output: "standalone",
};

export default nextConfig;
