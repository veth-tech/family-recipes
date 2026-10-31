import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { config } from "../env";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const sqlite = new Database(config.dbPath);

// WAL mode: survives restarts, allows concurrent reads during writes
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export { sqlite };
