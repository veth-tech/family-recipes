import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, type AppEnv } from "../middleware";
import { ImportError, importRecipeFromUrl } from "../services/import";
import {
  extractRecipeFromPhoto,
  extractRecipeFromText,
  fixRecipeWithPrompt,
  greenPtConfigured,
} from "../services/extract";
import { MAX_PHOTO_BYTES } from "../services/photos";
import * as photosService from "../services/photos";
import { idParams } from "./schemas";

const importUrlSchema = z.object({ url: z.string().url() });

const PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const recipeDraftSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  servings: z.number().nullable(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  ingredients: z.string(),
  instructions: z.string(),
  tags: z.array(z.string()),
  imageUrl: z.string().nullable(),
});

export function registerImportRoutes(app: OpenAPIHono<AppEnv>): void {
  // Parse a page's schema.org Recipe data into a review-only draft
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/import/url",
      tags: ["Import"],
      middleware: [requireAuth],
      request: {
        body: {
          content: { "application/json": { schema: importUrlSchema } },
          required: true,
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: recipeDraftSchema } },
          description: "Recipe draft (never saved — client shows it for review)",
        },
        400: { description: "Unreachable page / no recipe data" },
      },
    }),
    async (c) => {
      const { url } = c.req.valid("json");
      try {
        const draft = await importRecipeFromUrl(url);
        return c.json(draft);
      } catch (err) {
        const message =
          err instanceof ImportError
            ? err.message
            : "Couldn't fetch that page";
        return c.json({ error: message }, 400);
      }
    },
  );

  // Send a photo of a recipe (cookbook page, card, screenshot) to a vision
  // model → review-only draft. Same flow as /api/import/url.
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/import/photo",
      tags: ["Import"],
      middleware: [requireAuth],
      request: {
        body: {
          content: {
            "multipart/form-data": {
              schema: z.object({ file: z.instanceof(File) }),
            },
          },
          required: true,
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: recipeDraftSchema } },
          description: "Recipe draft (never saved — client shows it for review)",
        },
        400: { description: "Not a recipe / model or config error" },
      },
    }),
    async (c) => {
      if (!greenPtConfigured()) {
        return c.json(
          { error: "Photo import isn't configured — set GREENPT_API_KEY, GREENPT_BASE_URL and GREENPT_MODEL" },
          400,
        );
      }
      const { file } = c.req.valid("form");
      const mime = file.type.split(";")[0].trim().toLowerCase();
      if (!PHOTO_MIME_TYPES.includes(mime)) {
        return c.json(
          { error: `Unsupported image type: ${mime || "unknown"}` },
          400,
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      if (buffer.length > MAX_PHOTO_BYTES) {
        return c.json(
          { error: `Image too large (max ${MAX_PHOTO_BYTES / 1024 / 1024} MB)` },
          400,
        );
      }
      try {
        const draft = await extractRecipeFromPhoto(buffer, mime);
        return c.json(draft);
      } catch (err) {
        const message =
          err instanceof ImportError ? err.message : "Couldn't read that photo";
        return c.json({ error: message }, 400);
      }
    },
  );

  // Paste-the-page-text import: same AI path as the photo/text fallback, for
  // sites that block the backend's fetch.
  const importTextSchema = z.object({
    text: z.string().min(1).max(50_000),
  });

  app.openapi(
    createRoute({
      method: "post",
      path: "/api/import/text",
      tags: ["Import"],
      middleware: [requireAuth],
      request: {
        body: {
          content: { "application/json": { schema: importTextSchema } },
          required: true,
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: recipeDraftSchema } },
          description: "Recipe draft (never saved — client shows it for review)",
        },
        400: { description: "Not a recipe / model or config error" },
      },
    }),
    async (c) => {
      if (!greenPtConfigured()) {
        return c.json(
          { error: "Text import isn't configured — set GREENPT_API_KEY, GREENPT_BASE_URL and GREENPT_MODEL" },
          400,
        );
      }
      const { text } = c.req.valid("json");
      try {
        const draft = await extractRecipeFromText(text, null);
        return c.json(draft);
      } catch (err) {
        const message =
          err instanceof ImportError ? err.message : "Couldn't read that text";
        return c.json({ error: message }, 400);
      }
    },
  );

  // Apply a free-text fix instruction to an in-progress recipe (e.g. "remove
  // the prices from the ingredients"). Returns the full updated recipe.
  const fixSchema = z.object({
    prompt: z.string().min(1).max(2_000),
    recipe: z.object({
      title: z.string(),
      description: z.string().nullable().optional(),
      servings: z.number().nullable().optional(),
      prepMinutes: z.number().nullable().optional(),
      cookMinutes: z.number().nullable().optional(),
      ingredients: z.string().optional(),
      instructions: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  });

  app.openapi(
    createRoute({
      method: "post",
      path: "/api/import/fix",
      tags: ["Import"],
      middleware: [requireAuth],
      request: {
        body: {
          content: { "application/json": { schema: fixSchema } },
          required: true,
        },
      },
      responses: {
        200: {
          content: { "application/json": { schema: recipeDraftSchema } },
          description: "Full updated recipe as a draft",
        },
        400: { description: "Model or config error" },
      },
    }),
    async (c) => {
      if (!greenPtConfigured()) {
        return c.json(
          { error: "AI fixes aren't configured — set GREENPT_API_KEY, GREENPT_BASE_URL and GREENPT_MODEL" },
          400,
        );
      }
      const { prompt, recipe } = c.req.valid("json");
      try {
        const fixed = await fixRecipeWithPrompt(recipe, prompt);
        return c.json(fixed);
      } catch (err) {
        const message =
          err instanceof ImportError ? err.message : "Couldn't apply that fix";
        return c.json({ error: message }, 400);
      }
    },
  );

  // Server-side image download for imported recipes (avoids browser CORS)
  app.openapi(
    createRoute({
      method: "post",
      path: "/api/recipes/{id}/photos/from-url",
      tags: ["Photos"],
      middleware: [requireAuth],
      request: {
        params: idParams,
        body: {
          content: { "application/json": { schema: importUrlSchema } },
          required: true,
        },
      },
      responses: {
        201: {
          content: {
            "application/json": {
              schema: z.object({
                id: z.string(),
                url: z.string(),
                createdAt: z.string(),
              }),
            },
          },
          description: "Downloaded and saved photo",
        },
        400: { description: "Download failed" },
        404: { description: "Recipe not found" },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { url } = c.req.valid("json");
      const result = await photosService.addPhotoFromUrl(id, url);
      if ("error" in result) {
        return c.json({ error: result.error }, 400);
      }
      return c.json(result, 201);
    },
  );
}
