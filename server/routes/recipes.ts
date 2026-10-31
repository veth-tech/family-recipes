import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, type AppEnv } from "../middleware";
import * as recipesService from "../services/recipes";
import { searchRecipes } from "../services/search";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const idParams = z
  .object({ id: z.string().min(1) })
  .openapi({ param: { name: "id", in: "path", required: true } });

const searchQuery = z.object({
  q: z.string().optional().openapi({
    param: { name: "q", in: "query", description: "Fuzzy search query" },
  }),
});

const recipeInputSchema = z.object({
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

const noteSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

const recipeResponseSchema = z.object({
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
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const recipeDetailSchema = recipeResponseSchema.extend({
  notes: z.array(noteSchema),
});

const recipeResponseContent = {
  "application/json": { schema: recipeResponseSchema },
} as const;

// ---------------------------------------------------------------------------
// Routes — registered on the main app so /doc picks them all up.
// NOTE: /recipes/tags must be registered before /recipes/{id}.
// ---------------------------------------------------------------------------

export function registerRecipeRoutes(app: OpenAPIHono<AppEnv>): void {
  app.openapi(
    createRoute({
      method: "get",
      path: "/api/recipes",
      tags: ["Recipes"],
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({ recipes: z.array(recipeResponseSchema) }),
            },
          },
          description:
            "All recipes (the library fits in memory — the client filters)",
        },
      },
    }),
    async (c) => c.json({ recipes: await recipesService.listRecipes() }),
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/recipes/tags",
      tags: ["Recipes"],
      responses: {
        200: {
          content: {
            "application/json": { schema: z.object({ tags: z.array(z.string()) }) },
          },
          description: "Distinct tags across all recipes",
        },
      },
    }),
    async (c) => c.json({ tags: await recipesService.distinctTags() }),
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/api/recipes",
      tags: ["Recipes"],
      middleware: [requireAuth],
      request: {
        body: {
          content: { "application/json": { schema: recipeInputSchema } },
          required: true,
        },
      },
      responses: { 201: { content: recipeResponseContent, description: "Created recipe" } },
    }),
    async (c) => {
      const input = c.req.valid("json");
      const recipe = await recipesService.createRecipe(input, c.get("user").id);
      return c.json(recipe, 201);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/recipes/{id}",
      tags: ["Recipes"],
      request: { params: idParams },
      responses: {
        200: {
          content: { "application/json": { schema: recipeDetailSchema } },
          description: "Recipe with notes",
        },
        404: { description: "Not found" },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const recipe = await recipesService.getRecipe(id);
      if (!recipe) return c.json({ error: "Recipe not found" }, 404);
      return c.json(recipe);
    },
  );

  app.openapi(
    createRoute({
      method: "patch",
      path: "/api/recipes/{id}",
      tags: ["Recipes"],
      middleware: [requireAuth],
      request: {
        params: idParams,
        body: {
          content: { "application/json": { schema: recipeInputSchema.partial() } },
          required: true,
        },
      },
      responses: {
        200: { content: recipeResponseContent, description: "Updated recipe" },
        404: { description: "Not found" },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const recipe = await recipesService.updateRecipe(id, input);
      if (!recipe) return c.json({ error: "Recipe not found" }, 404);
      return c.json(recipe);
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/api/recipes/{id}",
      tags: ["Recipes"],
      middleware: [requireAuth],
      request: { params: idParams },
      responses: { 204: { description: "Deleted" }, 404: { description: "Not found" } },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const deleted = await recipesService.deleteRecipe(id);
      if (!deleted) return c.json({ error: "Recipe not found" }, 404);
      return c.body(null, 204);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/search",
      tags: ["Search"],
      request: { query: searchQuery },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                results: z.array(
                  z.object({ id: z.string(), title: z.string(), score: z.number() }),
                ),
              }),
            },
          },
          description:
            "Fuzzy full-text search over title, ingredients, instructions, tags",
        },
      },
    }),
    async (c) => {
      const { q } = c.req.valid("query");
      return c.json({ results: searchRecipes(q ?? "") });
    },
  );
}
