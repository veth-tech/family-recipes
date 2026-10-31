import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { requireAuth, type AppEnv } from "../middleware";
import * as recipesService from "../services/recipes";
import { searchRecipes } from "../services/search";
import {
  idParams,
  recipeDetailSchema,
  recipeInputSchema,
  recipeResponseContent,
  recipeResponseSchema,
  searchQuery,
} from "./schemas";

// ---------------------------------------------------------------------------
// Routes — registered on the main app so /doc picks them all up.
// NOTE: /recipes/tags must be registered before /recipes/{id}.
// Reads are public; writes require auth (login is "just for publishing").
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
