/**
 * Photo → recipe draft: send the image to a vision model through the Cline
 * SDK (@cline/llms) with greenPT as an OpenAI-compatible provider.
 * Drafts are never saved — same review-first flow as the URL importer.
 */

import { createHandler } from "@cline/llms";
import { config } from "../env";
import { ImportError, type RecipeDraft } from "./import";

const SYSTEM_PROMPT = `You extract recipes from photos of cookbook pages, recipe cards, and screenshots. Reply with ONLY a JSON object (no markdown fences) shaped like:
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
- ingredients: ONE INGREDIENT PER LINE, verbatim from the photo.
- instructions: markdown, numbered steps (use "### Section" headings if the photo has them).
- tags: lowercase, short, e.g. ["dessert", "baking"].
Use null for anything the photo doesn't show. If the image does not contain a recipe, reply exactly {"error": "not a recipe"}.`;

export function greenPtConfigured(): boolean {
  return Boolean(
    config.greenPt.apiKey && config.greenPt.baseUrl && config.greenPt.modelId,
  );
}

export async function extractRecipeFromPhoto(
  buffer: Buffer,
  mediaType: string,
): Promise<RecipeDraft> {
  const handler = createHandler({
    providerId: "openai-compatible",
    clientType: "openai-compatible",
    baseUrl: config.greenPt.baseUrl,
    apiKey: config.greenPt.apiKey,
    modelId: config.greenPt.modelId,
    capabilities: ["vision", "streaming"],
  });

  const stream = handler.createMessage(SYSTEM_PROMPT, [
    {
      role: "user",
      content: [
        { type: "image", data: buffer.toString("base64"), mediaType },
        { type: "text", text: "Extract this recipe as JSON." },
      ],
    },
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
      "The model didn't return readable recipe data — try a clearer photo",
    );
  }
  if (typeof parsed.error === "string") {
    throw new ImportError("That photo doesn't look like it contains a recipe");
  }

  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  return {
    title: str(parsed.title),
    description: str(parsed.description),
    sourceUrl: null,
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
    imageUrl: null,
  };
}

/** Tolerate models that wrap JSON in ```json fences despite instructions. */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}