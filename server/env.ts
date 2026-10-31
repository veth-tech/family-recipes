import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dataDir,
  dbPath: process.env.DATABASE_PATH
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(dataDir, "recipes.db"),
  isProd: process.env.NODE_ENV === "production",
  appUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:5173",
  secrets: {
    auth: required("BETTER_AUTH_SECRET"),
  },
};
