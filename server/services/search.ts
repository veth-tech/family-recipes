import MiniSearch from "minisearch";
import type { RecipeDTO } from "./recipes";

export type SearchHit = { id: string; title: string; score: number };

const SEARCH_FIELDS = [
  "title",
  "description",
  "ingredients",
  "instructions",
  "tags",
];

function createIndex(): MiniSearch<RecipeDTO> {
  return new MiniSearch<RecipeDTO>({
    fields: SEARCH_FIELDS,
    storeFields: ["id", "title"],
  });
}

// In-memory fuzzy index over the whole library. Rebuilt on every write —
// at ≤200 recipes this is instant and keeps the index always consistent.
let index = createIndex();

export function rebuildSearchIndex(recipes: RecipeDTO[]): void {
  index = createIndex();
  index.addAll(recipes);
  console.log(`[search] index rebuilt with ${recipes.length} docs`);
}

export function searchRecipes(query: string, limit = 25): SearchHit[] {
  if (!query.trim()) return [];
  return index
    .search(query, { fuzzy: 0.2, prefix: true })
    .slice(0, limit)
    .map((hit) => ({ id: hit.id, title: hit.title, score: hit.score }));
}
