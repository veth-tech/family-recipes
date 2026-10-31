import MiniSearch from "minisearch";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router";

import { RecipeCard } from "@/components/recipe-card";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import type { RecipeDTO } from "../../server/services/recipes";

export default function Home() {
  const { data: session, isPending } = useSession();
  const [recipes, setRecipes] = useState<RecipeDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const authed = !isPending && !!session;

  useEffect(() => {
    if (!authed) return;
    api
      .listRecipes()
      .then(setRecipes)
      .catch((err) => setError(err.message));
  }, [authed]);

  const tags = useMemo(
    () => [...new Set((recipes ?? []).flatMap((r) => r.tags))].sort(),
    [recipes],
  );

  // Client-side fuzzy index over the whole library — instant as-you-type
  const searchIndex = useMemo(() => {
    if (!recipes) return null;
    const index = new MiniSearch<RecipeDTO>({
      fields: ["title", "description", "ingredients", "instructions", "tags"],
      storeFields: ["id"],
    });
    index.addAll(recipes);
    return index;
  }, [recipes]);

  const filtered = useMemo(() => {
    if (!recipes) return [];
    let result = recipes;
    const q = query.trim();
    if (q && searchIndex) {
      const ids = new Set(
        searchIndex.search(q, { fuzzy: 0.2, prefix: true }).map((hit) => hit.id),
      );
      result = result.filter((r) => ids.has(r.id));
    }
    if (activeTags.length > 0) {
      result = result.filter((r) => activeTags.every((t) => r.tags.includes(t)));
    }
    return result;
  }, [recipes, query, activeTags, searchIndex]);

  function toggleTag(tag: string) {
    setActiveTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    );
  }

  if (isPending) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <p>Checking session…</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <AppHeader />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Our recipes</h1>
          {recipes && (
            <p className="text-sm text-foreground/60">
              {recipes.length} recipe{recipes.length === 1 ? "" : "s"} in the
              library
            </p>
          )}
        </div>
        <Button render={<Link to="/recipes/new" />}>+ Add recipe</Button>
      </div>

      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search recipes, ingredients… (fuzzy, typos welcome)"
        className="h-12 text-base"
      />

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Button
              key={tag}
              size="xs"
              variant={activeTags.includes(tag) ? "default" : "neutral"}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Button>
          ))}
          {activeTags.length > 0 && (
            <Button size="xs" variant="noShadow" onClick={() => setActiveTags([])}>
              clear
            </Button>
          )}
        </div>
      )}

      {error && <p className="mt-6 font-base text-[#FF4D50]">⚠️ {error}</p>}

      {recipes && (
        <>
          <p className="mt-6 text-sm text-foreground/60">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
            {query.trim() && ` for “${query.trim()}”`}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {filtered.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
          {recipes.length > 0 && filtered.length === 0 && (
            <div className="mt-6 rounded-base border-2 border-border bg-secondary-background p-6 text-center">
              <p className="font-heading">Nothing matches</p>
              <p className="text-sm text-foreground/60">
                Try fewer words — the fuzzy search forgives a lot, but not
                everything.
              </p>
            </div>
          )}
          {recipes.length === 0 && !error && (
            <div className="mt-6 rounded-base border-2 border-border bg-secondary-background p-6 text-center">
              <p className="font-heading">Empty library!</p>
              <p className="text-sm text-foreground/60">
                Add your first recipe to get started.
              </p>
              <div className="mt-4">
                <Button render={<Link to="/recipes/new" />}>+ Add recipe</Button>
              </div>
            </div>
          )}
        </>
      )}

      <p className="mt-10 text-center text-xs text-foreground/40">
        <Badge variant="neutral">M2</Badge> notes &amp; photos arrive in M3
      </p>
    </main>
  );
}
