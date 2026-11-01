/**
 * URL import: fetch a page, find its schema.org Recipe JSON-LD, and map it to
 * a draft. Drafts are never saved directly — the user reviews everything.
 * Pages without schema.org data fall back to AI extraction (see ./extract).
 */

import { extractRecipeFromText, greenPtConfigured } from "./extract";

export class ImportError extends Error {}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export type RecipeDraft = {
  title: string | null;
  description: string | null;
  sourceUrl: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string;
  instructions: string;
  tags: string[];
  imageUrl: string | null;
};

/** Basic SSRF guard: http(s) only, no loopback/private-link-local hosts. */
export function assertPublicHttpUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ImportError("That doesn't look like a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportError("Only http(s) URLs are supported");
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) {
    throw new ImportError("Private network URLs are not allowed");
  }
  return url;
}

export async function fetchPage(urlString: string): Promise<string> {
  const url = assertPublicHttpUrl(urlString);
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    if (res.status === 403) {
      throw new ImportError(
        "That site blocks automated readers — copy the recipe in manually for now",
      );
    }
    throw new ImportError(`That site responded with ${res.status}`);
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// JSON-LD extraction
// ---------------------------------------------------------------------------

function extractJsonLd(html: string): unknown[] {
  const chunks: unknown[] = [];
  const scriptRe =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptRe)) {
    const raw = match[1]
      .trim()
      .replace(/^<!\[CDATA\[/, "")
      .replace(/\]\]>$/, "");
    try {
      chunks.push(JSON.parse(raw));
    } catch {
      // malformed JSON-LD — skip this block
    }
  }
  return chunks;
}

function flattenNodes(node: unknown, acc: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const child of node) flattenNodes(child, acc);
  } else if (node && typeof node === "object") {
    acc.push(node);
    const graph = (node as { "@graph"?: unknown[] })["@graph"];
    if (Array.isArray(graph)) {
      for (const child of graph) flattenNodes(child, acc);
    }
  }
  return acc;
}

function isRecipeNode(node: unknown): boolean {
  const type = (node as { "@type"?: unknown })?.["@type"];
  if (typeof type === "string") return type.toLowerCase() === "recipe";
  if (Array.isArray(type)) {
    return type.some(
      (t) => typeof t === "string" && t.toLowerCase() === "recipe",
    );
  }
  return false;
}

function findRecipeNode(html: string): Record<string, unknown> | null {
  for (const chunk of extractJsonLd(html)) {
    const found = flattenNodes(chunk).find(isRecipeNode);
    if (found) return found as Record<string, unknown>;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field mappers
// ---------------------------------------------------------------------------

function decodeEntities(text: string): string {
  return text
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

/** "PT1H20M" / "P1DT2H" / "PT45M" → minutes */
function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (!match) return null;
  const total =
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0);
  return total > 0 ? total : null;
}

function parseServings(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value !== "string") return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function firstImageUrl(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = firstImageUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (value && typeof value === "object") {
    return firstImageUrl((value as { url?: unknown }).url);
  }
  return null;
}

/** recipeInstructions: strings | HowToStep | HowToSection → markdown */
function instructionsToMarkdown(value: unknown): string {
  if (typeof value === "string") {
    return cleanText(value) ?? "";
  }
  if (!Array.isArray(value)) return "";

  const lines: string[] = [];
  let step = 0;
  for (const item of value) {
    if (typeof item === "string") {
      step += 1;
      const text = cleanText(item);
      if (text) lines.push(`${step}. ${text}`);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const node = item as Record<string, unknown>;
    const type = node["@type"];
    const typeName =
      typeof type === "string"
        ? type.toLowerCase()
        : Array.isArray(type)
          ? String(type[0] ?? "").toLowerCase()
          : "";

    if (typeName === "howtosection") {
      const name = cleanText(node.name);
      if (name) lines.push(`### ${name}`);
      lines.push(instructionsToMarkdown(node.itemListElement));
      continue;
    }
    // HowToStep (or anything step-like with a text field)
    const text = cleanText(node.text);
    if (text) {
      step += 1;
      lines.push(`${step}. ${text}`);
    }
  }
  return lines.join("\n\n");
}

function collectTags(node: Record<string, unknown>): string[] {
  const raw: string[] = [];
  const keywords = node.keywords;
  if (typeof keywords === "string") raw.push(...keywords.split(","));
  for (const field of ["recipeCategory", "recipeCuisine"]) {
    const value = node[field];
    if (typeof value === "string") raw.push(value);
    else if (Array.isArray(value)) {
      for (const v of value) if (typeof v === "string") raw.push(v);
    }
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of raw) {
    const clean = decodeEntities(tag).trim().toLowerCase();
    if (!clean || clean.length > 50 || seen.has(clean)) continue;
    seen.add(clean);
    tags.push(clean);
    if (tags.length >= 20) break;
  }
  return tags;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/** og:image / twitter:image from meta tags — used when the AI path has no image. */
function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return match[1];
  }
  return null;
}

export async function importRecipeFromUrl(
  urlString: string,
): Promise<RecipeDraft> {
  const html = await fetchPage(urlString);
  const node = findRecipeNode(html);
  if (!node) {
    // No schema.org data — let the AI read the page text instead.
    if (!greenPtConfigured()) {
      throw new ImportError(
        "No schema.org recipe data found on that page and AI fallback isn't configured",
      );
    }
    const draft = await extractRecipeFromText(html, urlString);
    if (!draft.imageUrl) draft.imageUrl = extractOgImage(html);
    return draft;
  }

  const resolvedUrl = typeof node.url === "string" ? cleanText(node.url) : null;

  return {
    title: cleanText(node.name),
    description: cleanText(node.description),
    sourceUrl: resolvedUrl ?? urlString,
    servings: parseServings(node.recipeYield),
    prepMinutes: parseIsoDuration(node.prepTime),
    cookMinutes: parseIsoDuration(node.cookTime),
    ingredients: Array.isArray(node.recipeIngredient)
      ? node.recipeIngredient
          .map((i) => cleanText(i))
          .filter((i): i is string => !!i)
          .join("\n")
      : (cleanText(node.recipeIngredient) ?? ""),
    instructions: instructionsToMarkdown(node.recipeInstructions),
    tags: collectTags(node),
    imageUrl: firstImageUrl(node.image),
  };
}
