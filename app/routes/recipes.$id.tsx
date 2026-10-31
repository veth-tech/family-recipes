import { marked } from "marked";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import type { RecipeDetailDTO } from "../../server/services/recipes";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const [recipe, setRecipe] = useState<RecipeDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getRecipe(id)
      .then(setRecipe)
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleDelete() {
    if (!id || !window.confirm("Delete this recipe for good?")) return;
    setDeleting(true);
    try {
      await api.deleteRecipe(id);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <AppHeader />
        <p className="font-base text-[#FF4D50]">⚠️ {error}</p>
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p>Loading recipe…</p>
      </main>
    );
  }

  const prepTotal = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const ingredients = recipe.ingredients
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const instructionsHtml = recipe.instructions
    ? (marked.parse(recipe.instructions, { async: false }) as string)
    : "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <AppHeader />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{recipe.title}</h1>
          {recipe.description && (
            <p className="mt-1 text-foreground/70">{recipe.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {prepTotal > 0 && (
              <Badge variant="neutral">⏱ {formatMinutes(prepTotal)}</Badge>
            )}
            {recipe.servings && (
              <Badge variant="neutral">🍽 serves {recipe.servings}</Badge>
            )}
            {recipe.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          {(recipe.sourceUrl || recipe.sourceBook) && (
            <p className="mt-3 text-sm text-foreground/60">
              Source:{" "}
              {recipe.sourceUrl ? (
                <a
                  href={recipe.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {recipe.sourceUrl}
                </a>
              ) : null}
              {recipe.sourceUrl && recipe.sourceBook ? " · " : ""}
              {recipe.sourceBook}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {session ? (
            <>
              <Button render={<Link to={`/recipes/${recipe.id}/edit`} />}>
                Edit
              </Button>
              <Button
                variant="neutral"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </>
          ) : (
            <p className="max-w-[16rem] text-right text-xs text-foreground/50">
              Reading is public — sign in (top right) to edit.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">
        <Card className="h-fit bg-secondary-background">
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
          </CardHeader>
          <CardContent>
            {ingredients.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {ingredients.map((line, index) => (
                  <li key={index} className="flex gap-2">
                    <span aria-hidden className="text-main">
                      ●
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-foreground/50">None listed yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit bg-secondary-background">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            {instructionsHtml ? (
              <div
                className="[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-heading [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-heading [&_li]:ml-4 [&_li]:list-disc [&_ol_>li]:ml-4 [&_ol_>li]:list-decimal [&_p]:my-2 first:[&_p]:mt-0"
                dangerouslySetInnerHTML={{ __html: instructionsHtml }}
              />
            ) : (
              <p className="text-sm text-foreground/50">None listed yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 bg-secondary-background">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <p className="text-sm text-foreground/50">
            Tasting notes &amp; mods — composer arriving in M3
          </p>
        </CardHeader>
        <CardContent>
          {recipe.notes.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {recipe.notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-base border-2 border-border p-3"
                >
                  <p className="text-xs text-foreground/60">
                    {note.userName} · {note.createdAt.slice(0, 10)}
                  </p>
                  <p className="mt-1">{note.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground/50">No notes yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
