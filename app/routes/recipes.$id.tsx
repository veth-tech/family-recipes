import { marked } from "marked";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    if (!id) return;
    api
      .getRecipe(id)
      .then(setRecipe)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function handleAddNote(event: React.FormEvent) {
    event.preventDefault();
    if (!id || !noteText.trim()) return;
    setNoteBusy(true);
    try {
      await api.addNote(id, noteText.trim());
      setNoteText("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setNoteBusy(false);
    }
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!id || !files || files.length === 0) return;
    setPhotoBusy(true);
    try {
      const result = await api.uploadPhotos(id, Array.from(files));
      if (result.errors.length > 0) {
        setError(
          `Some photos failed: ${result.errors.map((e) => `${e.name} (${e.error})`).join(", ")}`,
        );
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!window.confirm("Remove this photo?")) return;
    try {
      await api.deletePhoto(photoId);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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

      {recipe.photos.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {recipe.photos.map((photo) => (
            <div key={photo.id} className="group relative">
              <img
                src={photo.url}
                alt=""
                loading="lazy"
                className="aspect-[4/3] w-full rounded-base border-2 border-border object-cover"
              />
              {session && (
                <Button
                  size="icon-xs"
                  variant="neutral"
                  className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => handleDeletePhoto(photo.id)}
                  title="Remove photo"
                >
                  ✕
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {session && (
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            hidden
            onChange={(event) => handlePhotoUpload(event.target.files)}
          />
          <Button
            variant="neutral"
            size="sm"
            disabled={photoBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {photoBusy ? "Uploading…" : "📷 Add photos"}
          </Button>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl">{recipe.title}</h1>
        {recipe.description && (
          <p className="mt-1 text-foreground/70">{recipe.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {prepTotal > 0 && (
            <Badge variant="neutral">⏱ {formatMinutes(prepTotal)}</Badge>
          )}
          {recipe.servings && (
            <Badge variant="neutral">Serves {recipe.servings}</Badge>
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
            Tasting notes &amp; mods — append-only, they never disappear.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {session ? (
            <form onSubmit={handleAddNote} className="flex flex-col gap-2">
              <Textarea
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                rows={3}
                placeholder="Doubled the garlic. Next time: less chili…"
              />
              <div>
                <Button type="submit" size="sm" disabled={noteBusy || !noteText.trim()}>
                  {noteBusy ? "Adding…" : "Add note"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-foreground/50">
              Sign in (top right) to leave a note.
            </p>
          )}

          {recipe.notes.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {recipe.notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-base border-2 border-border p-3"
                >
                  <p className="text-xs text-foreground/60">
                    <span className="font-heading">{note.userName}</span> ·{" "}
                    {note.createdAt.slice(0, 10)}
                  </p>
                  <div
                    className="mt-1 [&_li]:ml-4 [&_li]:list-disc [&_p]:my-1 first:[&_p]:mt-0"
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(note.body, { async: false }) as string,
                    }}
                  />
                </li>
              ))}
            </ul>
          ) : (
            !session && (
              <p className="text-sm text-foreground/50">No notes yet.</p>
            )
          )}
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-t-2 border-border pt-5">
        {session ? (
          <>
            <Button
              variant="neutral"
              size="sm"
              render={<Link to={`/recipes/${recipe.id}/edit`} />}
            >
              ✏️ Edit recipe
            </Button>
            <Button
              variant="neutral"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "🗑 Delete recipe"}
            </Button>
          </>
        ) : (
          <p className="text-xs text-foreground/50">
            Reading is public — sign in (top right) to edit.
          </p>
        )}
      </div>
    </main>
  );
}
