import { createMiddleware } from "hono/factory";
import { auth } from "./auth";

export type AuthUser = { id: string; name: string; email: string };

export type AppEnv = {
  Variables: { user: AuthUser };
};

/** Middleware: rejects unauthenticated requests, exposes the user as c.get("user") */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  await next();
});
