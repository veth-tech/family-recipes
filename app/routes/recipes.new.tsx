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
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  async function handleImport(event: React.FormEvent) {
    event.preventDefault();
    if (!importUrl.trim()) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const result = await api.importFromUrl(importUrl.trim());
      setDraft(result);
      setPhotoFile(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImportBusy(false);
    }
  }

  async function handlePhotoImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoFile) {
      setPhotoError("Choose a photo first");
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const result = await api.importPhoto(photoFile);
      setDraft(result);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : String(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handlePasteImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pasteText.trim()) return;
    setPasteBusy(true);
    setPasteError(null);
    try {
      const result = await api.importText(pasteText);
      setDraft(result);
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : String(err));
    } finally {
      setPasteBusy(false);
    }
  }

  async function handleSave(input: RecipeInput) {
    const recipe = await api.createRecipe(input);
    if (draft?.imageUrl) {
      // Best effort: photo import failing shouldn't block the save
      await api.addPhotoFromUrl(recipe.id, draft.imageUrl).catch(() => {});
    } else if (photoFile) {
      // The uploaded photo doubles as the recipe photo
      await api.uploadPhotos(recipe.id, [photoFile]).catch(() => {});
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
          <CardTitle>Import a recipe</CardTitle>
          <CardDescription>
            From a link or a photo — we pull the title, ingredients,
            instructions and photo. You review everything before it's saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="photo">
            <TabsList className="mb-4 grid w-full grid-cols-3">
              <TabsTrigger value="photo">From a photo</TabsTrigger>
              <TabsTrigger value="url">From a URL</TabsTrigger>
              <TabsTrigger value="text">Paste text</TabsTrigger>
            </TabsList>

            <TabsContent value="url">
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
            </TabsContent>

            <TabsContent value="photo">
              <form onSubmit={handlePhotoImport} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-base border-2 border-border bg-secondary-background px-3 text-sm font-base text-foreground placeholder:text-foreground/50 focus-within:outline-hidden focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-2">
                    <span className="truncate text-foreground/50">
                      {photoFile?.name ?? "No photo chosen"}
                    </span>
                    <input
                      type="file"
                      name="photo"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="sr-only"
                      onChange={(event) => {
                        setPhotoFile(event.target.files?.[0] ?? null);
                        setPhotoError(null);
                      }}
                    />
                    <span className="ml-auto inline-flex h-7 shrink-0 items-center rounded-sm border border-border bg-secondary-background px-2.5 text-sm font-heading">
                      Browse
                    </span>
                  </label>
                  <Button type="submit" disabled={photoBusy} className="shrink-0">
                    {photoBusy ? "Reading photo…" : "Extract"}
                  </Button>
                </div>
                {photoError && (
                  <p className="text-sm font-base text-[#FF4D50]">⚠️ {photoError}</p>
                )}
              </form>
            </TabsContent>

            <TabsContent value="text">
              <form onSubmit={handlePasteImport} className="flex flex-col gap-3">
                <Textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  rows={8}
                  placeholder="Open the recipe page, select all (⌘A), copy, paste here…"
                  required
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={pasteBusy || !pasteText.trim()}>
                    {pasteBusy ? "Parsing…" : "Parse"}
                  </Button>
                </div>
                {pasteError && (
                  <p className="text-sm font-base text-[#FF4D50]">⚠️ {pasteError}</p>
                )}
              </form>
            </TabsContent>
          </Tabs>
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
          await handleSave(input);
        }}
        onCancel={() => navigate("/")}
      />
    </main>
  );
}
