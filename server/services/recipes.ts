import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { notes, recipes, user } from "../db/schema";
import { rebuildSearchIndex } from "./search";

export type RecipeDTO = {
  id: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  sourceBook: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string;
  instructions: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type NoteDTO = {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
};

export type RecipeDetailDTO = RecipeDTO & { notes: NoteDTO[] };

export type RecipeInput = {
  title: string;
  description?: string | null;
  sourceUrl?: string | null;
  sourceBook?: string | null;
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients?: string;
  instructions?: string;
  tags?: string[];
};

type RecipeRow = typeof recipes.$inferSelect;

function toDTO(row: RecipeRow): RecipeDTO {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRecipes(): Promise<RecipeDTO[]> {
  const rows = await db.select().from(recipes).orderBy(desc(recipes.updatedAt));
  return rows.map(toDTO);
}

export async function getRecipe(id: string): Promise<RecipeDetailDTO | null> {
  const [row] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!row) return null;
  const noteRows = await db
    .select({
      id: notes.id,
      userId: notes.userId,
      body: notes.body,
      createdAt: notes.createdAt,
      userName: user.name,
    })
    .from(notes)
    .innerJoin(user, eq(notes.userId, user.id))
    .where(eq(notes.recipeId, id))
    .orderBy(desc(notes.createdAt));
  return {
    ...toDTO(row),
    notes: noteRows.map((n) => ({
      id: n.id,
      userId: n.userId,
      userName: n.userName,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function createRecipe(
  input: RecipeInput,
  userId: string,
): Promise<RecipeDTO> {
  const [row] = await db
    .insert(recipes)
    .values({
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sourceBook: input.sourceBook ?? null,
      servings: input.servings ?? null,
      prepMinutes: input.prepMinutes ?? null,
      cookMinutes: input.cookMinutes ?? null,
      ingredients: input.ingredients ?? "",
      instructions: input.instructions ?? "",
      tags: JSON.stringify(input.tags ?? []),
      createdBy: userId,
    })
    .returning();
  await refreshSearchIndex();
  return toDTO(row);
}

export async function updateRecipe(
  id: string,
  input: Partial<RecipeInput>,
): Promise<RecipeDTO | null> {
  const [row] = await db
    .update(recipes)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.sourceUrl !== undefined && { sourceUrl: input.sourceUrl }),
      ...(input.sourceBook !== undefined && { sourceBook: input.sourceBook }),
      ...(input.servings !== undefined && { servings: input.servings }),
      ...(input.prepMinutes !== undefined && { prepMinutes: input.prepMinutes }),
      ...(input.cookMinutes !== undefined && { cookMinutes: input.cookMinutes }),
      ...(input.ingredients !== undefined && { ingredients: input.ingredients }),
      ...(input.instructions !== undefined && { instructions: input.instructions }),
      ...(input.tags !== undefined && { tags: JSON.stringify(input.tags) }),
      updatedAt: new Date(),
    })
    .where(eq(recipes.id, id))
    .returning();
  if (!row) return null;
  await refreshSearchIndex();
  return toDTO(row);
}

export async function deleteRecipe(id: string): Promise<boolean> {
  const rows = await db
    .delete(recipes)
    .where(eq(recipes.id, id))
    .returning({ id: recipes.id });
  if (rows.length === 0) return false;
  await refreshSearchIndex();
  return true;
}

export async function distinctTags(): Promise<string[]> {
  const all = await listRecipes();
  return [...new Set(all.flatMap((r) => r.tags))].sort();
}

/** Rebuild the in-memory search index from the DB. */
export async function refreshSearchIndex(): Promise<void> {
  rebuildSearchIndex(await listRecipes());
}
