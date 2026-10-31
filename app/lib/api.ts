import type {
  NoteDTO,
  RecipeDetailDTO,
  RecipeDTO,
  RecipeInput,
} from "../../server/services/recipes";
import type { PhotoDTO } from "../../server/services/photos";
import type { SearchHit } from "../../server/services/search";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json", ...init?.headers }
        : init?.headers,
  });
  if (res.status === 401) {
    throw new ApiError("Not signed in", 401);
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { error?: string; message?: string };
      message = data.error ?? data.message ?? message;
    } catch {
      // keep default message
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listRecipes: () =>
    request<{ recipes: RecipeDTO[] }>("/api/recipes").then((r) => r.recipes),

  getRecipe: (id: string) => request<RecipeDetailDTO>(`/api/recipes/${id}`),

  createRecipe: (input: RecipeInput) =>
    request<RecipeDTO>("/api/recipes", { method: "POST", body: JSON.stringify(input) }),

  updateRecipe: (id: string, input: RecipeInput) =>
    request<RecipeDTO>(`/api/recipes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteRecipe: (id: string) =>
    request<void>(`/api/recipes/${id}`, { method: "DELETE" }),

  search: (q: string) =>
    request<{ results: SearchHit[] }>(
      `/api/search?q=${encodeURIComponent(q)}`,
    ).then((r) => r.results),

  addNote: (recipeId: string, body: string) =>
    request<NoteDTO>(`/api/recipes/${recipeId}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),

  uploadPhotos: (recipeId: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    return request<{ photos: PhotoDTO[]; errors: { name: string; error: string }[] }>(
      `/api/recipes/${recipeId}/photos`,
      { method: "POST", body: form },
    );
  },

  deletePhoto: (photoId: string) =>
    request<void>(`/api/photos/${photoId}`, { method: "DELETE" }),
};
