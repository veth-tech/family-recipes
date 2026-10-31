import { useState } from "react";
import { useNavigate } from "react-router";

import { RecipeForm } from "@/components/recipe-form";
import { AppHeader } from "@/components/app-header";
import { SignInForm } from "@/components/sign-in-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import type { RecipeDraft } from "../../server/services/import";
import type { RecipeInput } from "../../server/services/recipes";

export default function NewRecipe() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    if (!importUrl.trim()) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const result = await api.importFromUrl(importUrl.trim());
      setDraft(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportBusy(false);
    }
  }

  async function handleSave(input: RecipeInput, imageUrl: string | null) {
    const recipe = await api.createRecipe(input);
    if (imageUrl) {
      // Best effort: photo import failing shouldn't block the save
      await api.addPhotoFromUrl(recipe.id, imageUrl).catch(() => {});
    }
    navigate(`/recipes/${recipe.id}`);
  }

  if (isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p>Checking session…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <AppHeader />
        <Card className="bg-secondary-background">
          <CardHeader>
            <CardTitle>Sign in to add recipes</CardTitle>
            <CardDescription>
              Reading is public — publishing is just for the two of us.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm />
          </CardContent>
        </Card>
      </main>
    );
  }

  const draftInitial: Partial<RecipeInput> | undefined = draft
    ? {
        title: draft.title ?? "",
        description: draft.description,
        sourceUrl: draft.sourceUrl,
        servings: draft.servings,
        prepMinutes: draft.prepMinutes,
        cookMinutes: draft.cookMinutes,
        ingredients: draft.ingredients,
        instructions: draft.instructions,
        tags: draft.tags,
      }
    : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <AppHeader />
      <h1 className="mb-6 text-3xl">New recipe</h1>

      <Card className="mb-8 bg-secondary-background">
        <CardHeader>
          <CardTitle>Import from a URL</CardTitle>
          <CardDescription>
            Paste a recipe link — we pull the title, ingredients, instructions
            and photo. You review everything before it's saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleImport} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="url"
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                placeholder="https://somegreatfoodblog.com/recipe…"
                required
              />
              <Button type="submit" disabled={importBusy} className="shrink-0">
                {importBusy ? "Importing…" : "Import"}
              </Button>
            </div>
            {importError && (
              <p className="text-sm font-base text-[#FF4D50]">⚠️ {importError}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {draft && (
        <p className="mb-4 rounded-base border-2 border-border bg-background px-3 py-2 text-sm">
          ✨ Imported draft — <span className="font-heading">review it</span>,
          tweak what the parser got wrong, then save. The photo is imported
          automatically after saving.
        </p>
      )}

      <RecipeForm
        key={draft ? "draft" : "blank"}
        initial={draftInitial}
        submitLabel={draft ? "Save recipe" : "Create recipe"}
        onSubmit={async (input) => {
          await handleSave(input, draft?.imageUrl ?? null);
        }}
        onCancel={() => navigate("/")}
      />
    </main>
  );
}
