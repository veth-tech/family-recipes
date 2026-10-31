import { z } from "@hono/zod-openapi";

// ---------------------------------------------------------------------------
// Shared OpenAPI schemas (used by recipes + media routes)
// ---------------------------------------------------------------------------

export const idParams = z
  .object({ id: z.string().min(1) })
  .openapi({ param: { name: "id", in: "path", required: true } });

export const searchQuery = z.object({
  q: z.string().optional().openapi({
    param: { name: "q", in: "query", description: "Fuzzy search query" },
  }),
});

export const recipeInputSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).nullable().optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  sourceBook: z.string().max(300).nullable().optional(),
  servings: z.number().int().positive().max(99).nullable().optional(),
  prepMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  cookMinutes: z.number().int().min(0).max(10080).nullable().optional(),
  ingredients: z.string().max(20000).optional(),
  instructions: z.string().max(100000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export const noteResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const photoResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  createdAt: z.string(),
});

export const recipeResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceBook: z.string().nullable(),
  servings: z.number().nullable(),
  prepMinutes: z.number().nullable(),
  cookMinutes: z.number().nullable(),
  ingredients: z.string(),
  instructions: z.string(),
  tags: z.array(z.string()),
  primaryPhotoId: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const recipeDetailSchema = recipeResponseSchema.extend({
  notes: z.array(noteResponseSchema),
  photos: z.array(photoResponseSchema),
});

export const recipeResponseContent = {
  "application/json": { schema: recipeResponseSchema },
} as const;
