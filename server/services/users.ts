import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { account, user } from "../db/schema";
import { auth } from "../auth";

/**
 * Create a user directly in the DB (bypassing better-auth's sign-up flow,
 * which is locked to invite-only). Used by the create-user CLI and the
 * seed script.
 */
export async function createUserDirect(
  email: string,
  name: string,
  password: string,
): Promise<{ id: string } | { error: string }> {
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, email));
  if (existing) {
    return { error: `A user with email ${email} already exists` };
  }

  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash(password);

  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(user).values({
    id,
    name,
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: "credential",
    userId: id,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}
