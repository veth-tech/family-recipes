import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { auth } from "./auth";
import { runMigrations } from "./db/migrate";
import { config } from "./env";

runMigrations();

const app = new OpenAPIHono();

// --- Health -----------------------------------------------------------------

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "family-recipes",
    time: new Date().toISOString(),
  }),
);

// --- Auth (better-auth) -------------------------------------------------------

// better-auth uses the Web Standard Request/Response APIs, so it mounts
// directly on Hono. Must be registered before any catch-all route.
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// Convenience endpoint: who am I? Proves the session cookie round-trips.
app.get("/api/me", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ user: null }, 401);
  }
  return c.json({
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
  });
});

// --- API docs ----------------------------------------------------------------

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    title: "Family Recipes API",
    version: "0.1.0",
    description: "Private recipe library API for our AI assistants too.",
  },
});

app.get("/docs", swaggerUI({ url: "/doc" }));

// --- Static frontend (production only) ----------------------------------------

if (config.isProd) {
  app.use("*", serveStatic({ root: "./build/client" }));
  // SPA fallback: any non-API GET serves the app shell
  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "Not found" }, 404);
    }
    const res = await serveStatic({ path: "./build/client/index.html" })(
      c,
      async () => {},
    );
    return res ?? new Response("Not found", { status: 404 });
  });
}

// --- Boot ---------------------------------------------------------------------

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[server] family-recipes API on http://localhost:${info.port}`);
  if (config.isProd) {
    console.log("[server] serving static frontend from ./build/client");
  }
});
