/**
 * AI recipe extraction through the Cline SDK (@cline/llms) with greenPT as an
 * OpenAI-compatible provider. Two entry points:
 *   - extractRecipeFromPhoto: vision on an uploaded image
 *   - extractRecipeFromText: fallback for URL imports that have no schema.org data
 * Drafts are never saved — same review-first flow as the URL importer.
 */

import { createHandler, type ApiHandler, type ContentBlock } from "@cline/llms";
import { config } from "../env";
import { ImportError, type RecipeDraft } from "./import";

const SYSTEM_PROMPT = `You extract recipes from photos of cookbook pages, recipe cards, screenshots, and web page text. Reply with ONLY a JSON object (no markdown fences) shaped like:
{
  "title": string,
  "description": string | null,
  "servings": number | null,
  "prepMinutes": number | null,
  "cookMinutes": number | null,
  "ingredients": string,
  "instructions": string,
  "tags": string[]
}
- ingredients: ONE INGREDIENT PER LINE, verbatim from the source.
- instructions: markdown, numbered steps (use "### Section" headings if the source has them).
- tags: lowercase, short, e.g. ["dessert", "baking"].
Use null for anything the source doesn't show. If the source does not contain a recipe, reply exactly {"error": "not a recipe"}.`;

export function greenPtConfigured(): boolean {
  return Boolean(
    config.greenPt.apiKey && config.greenPt.baseUrl && config.greenPt.modelId,
  );
}

function greenPtHandler(): ApiHandler {
  return createHandler({
    providerId: "openai-compatible",
    clientType: "openai-compatible",
    baseUrl: config.greenPt.baseUrl,
    apiKey: config.greenPt.apiKey,
    modelId: config.greenPt.modelId,
    capabilities: ["vision", "streaming"],
  });
}

async function runGreenPt(
  handler: ApiHandler,
  content: ContentBlock[],
  systemPrompt: string = SYSTEM_PROMPT,
): Promise<RecipeDraft> {
  const stream = handler.createMessage(systemPrompt, [
    { role: "user", content },
  ]);

  let text = "";
  for await (const chunk of stream) {
    if (chunk.type === "text") text += chunk.text;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    throw new ImportError(
      "The model didn't return readable recipe data — try again with a clearer source",
    );
  }
  if (typeof parsed.error === "string") {
    throw new ImportError("That doesn't look like it contains a recipe");
  }
  return mapParsedToDraft(parsed);
}

export async function extractRecipeFromPhoto(
  buffer: Buffer,
  mediaType: string,
): Promise<RecipeDraft> {
  return runGreenPt(greenPtHandler(), [
    { type: "image", data: buffer.toString("base64"), mediaType },
    { type: "text", text: "Extract this recipe as JSON." },
  ]);
}

/**
 * Fallback for URL imports with no schema.org data: feed the page's visible
 * text to the model and let it find the recipe. Source URL is preserved since
 * we know where the text came from.
 */
export async function extractRecipeFromText(
  text: string,
  sourceUrl: string | null,
): Promise<RecipeDraft> {
  const draft = await runGreenPt(greenPtHandler(), [
    {
      type: "text",
      text: `Extract the recipe from this source as JSON.\n\n${htmlToText(text)}`,
    },
  ]);
  // Source URL is only set when we actually know it (URL import) — never
  // trust the model to echo it.
  draft.sourceUrl = sourceUrl;
  return draft;
}

function mapParsedToDraft(parsed: Record<string, unknown>): RecipeDraft {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  return {
    title: str(parsed.title),
    description: str(parsed.description),
    sourceUrl: str(parsed.sourceUrl),
    servings: num(parsed.servings),
    prepMinutes: num(parsed.prepMinutes),
    cookMinutes: num(parsed.cookMinutes),
    ingredients:
      typeof parsed.ingredients === "string" ? parsed.ingredients : "",
    instructions:
      typeof parsed.instructions === "string" ? parsed.instructions : "",
    tags: Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      : [],
    imageUrl: str(parsed.imageUrl),
  };
}

/** Tolerate models that wrap JSON in ```json fences despite instructions. */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Apply a free-text edit instruction (e.g. "remove the prices from the
 * ingredients") to a user's already-filled recipe. Returns the full updated
 * recipe as a draft; the client decides what to overwrite.
 */
export async function fixRecipeWithPrompt(
  recipe: {
    title: string;
    description?: string | null;
    servings?: number | null;
    prepMinutes?: number | null;
    cookMinutes?: number | null;
    ingredients?: string;
    instructions?: string;
    tags?: string[];
  },
  prompt: string,
): Promise<RecipeDraft> {
  return runGreenPt(
    greenPtHandler(),
    [
      {
        type: "text",
        text: `Instruction: ${prompt}\n\nRecipe:\n${JSON.stringify(recipe, null, 2)}`,
      },
    ],
    `You apply an edit instruction to a recipe. Reply with ONLY a JSON object (no markdown fences) containing the FULL updated recipe, shaped like:
{
  "title": string,
  "description": string | null,
  "servings": number | null,
  "prepMinutes": number | null,
  "cookMinutes": number | null,
  "ingredients": string,
  "instructions": string,
  "tags": string[]
}
- ingredients: ONE INGREDIENT PER LINE.
- instructions: markdown, numbered steps.
Keep everything the instruction doesn't mention unchanged. If the instruction can't apply to this recipe, return the recipe unchanged.`,
  );
}

/** Cheap HTML → text: drop scripts/styles/tags, decode the usual entities. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    // ponytail: 30k chars (~8k tokens) cap; truncate blindly — recipes almost
    // never sit past the intro prose. Chunk-by-section if real pages overflow.
    .slice(0, 30_000);
}