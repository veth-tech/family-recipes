import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "app"),
    },
  },
  server: {
    proxy: {
      // Proxy API calls to the Hono server during development.
      // Must match PORT in .env (3000 was taken on this machine).
      "/api": {
        target: "http://localhost:3001",
      },
    },
  },
});
