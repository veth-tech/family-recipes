import { betterAuth } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { count } from "drizzle-orm";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { user } from "./db/schema";
import { config } from "./env";

function isAdminEmail(email: string): boolean {
  return config.adminEmails.includes(email.toLowerCase());
}

/** Fresh deployment? The first sign-up claims the site. */
async function isEmptyInstall(): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(user);
  return (row?.value ?? 0) === 0;
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
      //
      // Exception: on a fresh deployment (zero users), the first sign-up
      // is allowed so the owner can claim the site — it locks immediately
      // after that.
      if (ctx.path !== "/sign-up/email") return;
      if (await isEmptyInstall()) return;
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
