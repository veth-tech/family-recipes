import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, type AppEnv } from "../middleware";
import { addNote, getRecipe } from "../services/recipes";
import * as photosService from "../services/photos";
import { idParams, noteResponseSchema } from "./schemas";

const noteInputSchema = z.object({
  body: z.string().min(1).max(5000),
});

const photoUploadResponseSchema = z.object({
  photos: z.array(
    z.object({ id: z.string(), url: z.string(), createdAt: z.string() }),
  ),
  errors: z.array(z.object({ name: z.string(), error: z.string() })),
});

export function registerMediaRoutes(app: OpenAPIHono<AppEnv>): void {
  // --- Notes (append-only) --------------------------------------------------

  app.openapi(
    createRoute({
      method: "post",
      path: "/api/recipes/{id}/notes",
      tags: ["Notes"],
      middleware: [requireAuth],
      request: {
        params: idParams,
        body: {
          content: { "application/json": { schema: noteInputSchema } },
          required: true,
        },
      },
      responses: {
        201: {
          content: { "application/json": { schema: noteResponseSchema } },
          description: "Created note",
        },
        404: { description: "Recipe not found" },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { body } = c.req.valid("json");
      const note = await addNote(id, c.get("user").id, body);
      if (!note) return c.json({ error: "Recipe not found" }, 404);
      return c.json(note, 201);
    },
  );

  // --- Photos ----------------------------------------------------------------

  app.openapi(
    createRoute({
      method: "post",
      path: "/api/recipes/{id}/photos",
      tags: ["Photos"],
      middleware: [requireAuth],
      request: { params: idParams },
      responses: {
        201: {
          content: {
            "application/json": { schema: photoUploadResponseSchema },
          },
          description: "Uploaded photos (plus per-file errors, if any)",
        },
        400: { description: "No valid files uploaded" },
        404: { description: "Recipe not found" },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      if (!(await getRecipe(id))) {
        return c.json({ error: "Recipe not found" }, 404);
      }
      const body = await c.req.parseBody({ all: true });
      const files = [...Object.values(body)].filter(
        (value): value is File => value instanceof File,
      );
      if (files.length === 0) {
        return c.json(
          { error: "No files uploaded (use multipart field 'files')" },
          400,
        );
      }
      const saved: { id: string; url: string; createdAt: string }[] = [];
      const errors: { name: string; error: string }[] = [];
      for (const file of files) {
        const result = await photosService.addPhoto(id, file);
        if ("error" in result) {
          errors.push({ name: file.name, error: result.error });
        } else {
          saved.push(result);
        }
      }
      if (saved.length === 0) {
        return c.json(
          { error: errors[0]?.error ?? "Upload failed" },
          400,
        );
      }
      return c.json({ photos: saved, errors }, 201);
    },
  );

  // Public: photo bytes, immutable cache (ids are uuids, content never changes)
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/photos/{id}",
      tags: ["Photos"],
      request: { params: idParams },
      responses: {
        200: { description: "Image bytes" },
        404: { description: "Not found" },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const meta = await photosService.getPhotoMeta(id);
      if (!meta) return c.json({ error: "Photo not found" }, 404);
      try {
        const buffer = await import("node:fs/promises").then((fs) =>
          fs.readFile(meta.filePath),
        );
        return c.body(buffer, 200, {
          "Content-Type": meta.mime,
          "Cache-Control": "public, max-age=31536000, immutable",
        });
      } catch {
        return c.json({ error: "Photo file missing" }, 404);
      }
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/api/photos/{id}",
      tags: ["Photos"],
      middleware: [requireAuth],
      request: { params: idParams },
      responses: {
        204: { description: "Deleted" },
        404: { description: "Not found" },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const deleted = await photosService.deletePhoto(id);
      if (!deleted) return c.json({ error: "Photo not found" }, 404);
      return c.body(null, 204);
    },
  );
}
