import type { Config } from "@react-router/dev/config";

export default {
  appDirectory: "app",
  // SPA mode: the container serves static files + the Hono API.
  // No SSR machinery to run — right call for a private two-user app.
  ssr: false,
} satisfies Config;
