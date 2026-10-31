import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, type AppEnv } from "../middleware";
import { ImportError, importRecipeFromUrl } from "../services/import";
import * as photosService from "../services/photos";
import { idParams } from "./schemas";

const importUrlSchema = z.object({ url: z.string().url() });

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
