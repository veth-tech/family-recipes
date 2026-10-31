import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { photos } from "../db/schema";
import { config } from "../env";

import { assertPublicHttpUrl } from "./import";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

export type PhotoDTO = { id: string; url: string; createdAt: string };

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const EXT_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_EXT).map(([mime, ext]) => [ext, mime]),
);

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

function photosDir(): string {
  return path.join(config.dataDir, "photos");
}

function photoFilePath(recipeId: string, filename: string): string {
  return path.join(photosDir(), recipeId, filename);
}

export async function removePhotoFile(
  recipeId: string,
  filename: string,
): Promise<void> {
  try {
    await fs.rm(photoFilePath(recipeId, filename));
    // Best effort: remove the recipe's photo dir if it's now empty
    await fs.rmdir(path.join(photosDir(), recipeId)).catch(() => {});
  } catch {
    // file already gone — fine
  }
}

export async function addPhoto(
  recipeId: string,
  file: File,
): Promise<PhotoDTO | { error: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return savePhotoBuffer(recipeId, buffer, file.type);
}

/** Download an image from a URL (server-side, avoids CORS) and save it. */
export async function addPhotoFromUrl(
  recipeId: string,
  urlString: string,
): Promise<PhotoDTO | { error: string }> {
  try {
    const url = assertPublicHttpUrl(urlString);
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return { error: `Image host responded with ${res.status}` };
    }
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const buffer = Buffer.from(await res.arrayBuffer());
    return savePhotoBuffer(recipeId, buffer, mime);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Image download failed",
    };
  }
}

async function savePhotoBuffer(
  recipeId: string,
  buffer: Buffer,
  mime: string,
): Promise<PhotoDTO | { error: string }> {
  const ext = MIME_EXT[mime];
  if (!ext) {
    return { error: `Unsupported image type: ${mime || "unknown"}` };
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    return { error: `Image too large (max ${MAX_PHOTO_BYTES / 1024 / 1024} MB)` };
  }

  const id = crypto.randomUUID();
  const filename = `${id}.${ext}`;
  await fs.mkdir(path.join(photosDir(), recipeId), { recursive: true });
  await fs.writeFile(photoFilePath(recipeId, filename), buffer);

  const [row] = await db
    .insert(photos)
    .values({ id, recipeId, filename })
    .returning();
  return toDTO(row);
}

export async function getPhotoMeta(
  id: string,
): Promise<{ filePath: string; mime: string } | null> {
  const [row] = await db.select().from(photos).where(eq(photos.id, id));
  if (!row) return null;
  const ext = row.filename.split(".").pop() ?? "";
  return {
    filePath: photoFilePath(row.recipeId, row.filename),
    mime: EXT_MIME[ext] ?? "application/octet-stream",
  };
}

export async function deletePhoto(id: string): Promise<boolean> {
  const [row] = await db.select().from(photos).where(eq(photos.id, id));
  if (!row) return false;
  await db.delete(photos).where(eq(photos.id, id));
  await removePhotoFile(row.recipeId, row.filename);
  return true;
}

export async function listPhotosForRecipe(recipeId: string): Promise<PhotoDTO[]> {
  const rows = await db
    .select()
    .from(photos)
    .where(eq(photos.recipeId, recipeId))
    .orderBy(photos.createdAt);
  return rows.map(toDTO);
}

/** First photo (by upload time) per recipe — for home card thumbnails. */
export async function firstPhotoByRecipe(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: photos.id, recipeId: photos.recipeId, createdAt: photos.createdAt })
    .from(photos)
    .orderBy(photos.createdAt);
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.recipeId)) map.set(row.recipeId, row.id);
  }
  return map;
}

type PhotoRow = typeof photos.$inferSelect;

function toDTO(row: PhotoRow): PhotoDTO {
  return {
    id: row.id,
    url: `/api/photos/${row.id}`,
    createdAt: row.createdAt.toISOString(),
  };
}
