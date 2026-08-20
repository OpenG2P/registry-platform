import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SPA is shipped as an independent image (openg2p-registry-agent-ui) served by nginx
// at the host root. Istio routes `/agent_portal/*` to the backend Service and
// everything else to this UI Service — so the app runs at `/` and API
// calls use the same origin.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Dev only: forward API calls to a local uvicorn. In production,
      // Istio does this at the host level and nginx never proxies.
      "/agent_portal": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
