import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { notes, photos, recipes, user } from "../db/schema";
import { rebuildSearchIndex } from "./search";
import {
  firstPhotoByRecipe,
  listPhotosForRecipe,
  removePhotoFile,
  type PhotoDTO,
} from "./photos";

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
  primaryPhotoId: string | null;
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

export type RecipeDetailDTO = RecipeDTO & {
  notes: NoteDTO[];
  photos: PhotoDTO[];
};

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

function toDTO(row: RecipeRow, primaryPhotoId: string | null): RecipeDTO {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    primaryPhotoId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRecipes(): Promise<RecipeDTO[]> {
  const rows = await db.select().from(recipes).orderBy(desc(recipes.updatedAt));
  const photoMap = await firstPhotoByRecipe();
  return rows.map((row) => toDTO(row, photoMap.get(row.id) ?? null));
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
    ...toDTO(row, (await listPhotosForRecipe(id))[0]?.id ?? null),
    notes: noteRows.map((n) => ({
      id: n.id,
      userId: n.userId,
      userName: n.userName,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
    })),
    photos: await listPhotosForRecipe(id),
  };
}

/** Append-only notes: no edit, no delete — just like tasting notes. */
export async function addNote(
  recipeId: string,
  userId: string,
  body: string,
): Promise<NoteDTO | null> {
  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.id, recipeId));
  if (!recipe) return null;
  const [row] = await db
    .insert(notes)
    .values({ id: crypto.randomUUID(), recipeId, userId, body })
    .returning();
  const [author] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId));
  return {
    id: row.id,
    userId: row.userId,
    userName: author?.name ?? "Unknown",
    body: row.body,
    createdAt: row.createdAt.toISOString(),
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
  return toDTO(row, null); // brand-new recipe has no photos yet
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
  return toDTO(row, (await listPhotosForRecipe(id))[0]?.id ?? null);
}

export async function deleteRecipe(id: string): Promise<boolean> {
  // Clean up photo files before the FK cascade removes the rows
  const photoRows = await db
    .select({ filename: photos.filename, recipeId: photos.recipeId })
    .from(photos)
    .where(eq(photos.recipeId, id));
  const rows = await db
    .delete(recipes)
    .where(eq(recipes.id, id))
    .returning({ id: recipes.id });
  if (rows.length === 0) return false;
  await Promise.all(
    photoRows.map((p) => removePhotoFile(p.recipeId, p.filename)),
  );
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
