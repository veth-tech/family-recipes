import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client";

/**
 * Apply pending drizzle-kit migrations. Runs at server startup so the
 * container is self-migrating — no separate migration step to forget.
 */
export function runMigrations(): void {
  migrate(db, { migrationsFolder: "server/db/migrations" });
  console.log("[db] migrations applied");
}
