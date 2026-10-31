import { betterAuth } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { config } from "./env";

function isAdminEmail(email: string): boolean {
  return config.adminEmails.includes(email.toLowerCase());
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: [config.appUrl],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Registration is invite-only: only an authenticated admin may
      // create accounts. Everyone else (including other signed-in users)
      // is rejected — the owner adds people via `npm run create-user`.
      if (ctx.path !== "/sign-up/email") return;
      const session = await auth.api.getSession({
        headers: ctx.headers ?? new Headers(),
      });
      if (!session || !isAdminEmail(session.user.email)) {
        throw new APIError("FORBIDDEN", {
          message:
            "Registration is invite-only. Ask the site owner to create your account.",
        });
      }
    }),
  },
});
