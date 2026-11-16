import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies every /api call to the FastAPI backend so the browser
// only ever talks to one origin (no CORS, no environment-specific base URLs).
const API_TARGET = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
    },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  preview: { host: "0.0.0.0", port: 5173, strictPort: true },
  build: { outDir: "dist", sourcemap: false },
});
