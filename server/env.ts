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
  // Registration is invite-only: only these emails may create accounts
  // (via an authenticated session), plus the create-user CLI script.
  adminEmails: (process.env.ADMIN_EMAILS ?? "seed@family.recipes")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  secrets: {
    auth: required("BETTER_AUTH_SECRET"),
  },
  // Photo → recipe extraction: greenPT via the Cline SDK (@cline/llms),
  // spoken to as a plain OpenAI-compatible endpoint. Optional: the photo
  // import route returns a friendly error until these are set.
  greenPt: {
    apiKey: process.env.GREENPT_API_KEY ?? "",
    baseUrl: process.env.GREENPT_BASE_URL ?? "",
    modelId: process.env.GREENPT_MODEL ?? "",
  },
};
