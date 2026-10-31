import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { RecipeInput } from "../../server/services/recipes";

type Props = {
  initial?: Partial<RecipeInput>;
  submitLabel: string;
  onSubmit: (input: RecipeInput) => Promise<void>;
  onCancel?: () => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-heading">{label}</span>
      {children}
    </label>
  );
}

export function RecipeForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [sourceBook, setSourceBook] = useState(initial?.sourceBook ?? "");
  const [servings, setServings] = useState(initial?.servings?.toString() ?? "");
  const [prepMinutes, setPrepMinutes] = useState(initial?.prepMinutes?.toString() ?? "");
  const [cookMinutes, setCookMinutes] = useState(initial?.cookMinutes?.toString() ?? "");
  const [ingredients, setIngredients] = useState(initial?.ingredients ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [tagText, setTagText] = useState((initial?.tags ?? []).join(", "));
  const [allTags, setAllTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Existing tags across the library — clickable chips under the input
  useEffect(() => {
    api
      .tags()
      .then(setAllTags)
      .catch(() => {}); // non-fatal: typing tags manually always works
  }, []);

  const tags = tagText
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  function toggleTag(tag: string) {
    const next = tags.includes(tag)
      ? tags.filter((t) => t !== tag)
      : [...tags, tag];
    setTagText(next.join(", "));
  }

  const numberOrNull = (value: string) =>
    value.trim() === "" ? null : Number(value);

  function buildInput(): RecipeInput {
    return {
      title: title.trim(),
      description: description.trim() || null,
      sourceUrl: sourceUrl.trim() || null,
      sourceBook: sourceBook.trim() || null,
      servings: numberOrNull(servings),
      prepMinutes: numberOrNull(prepMinutes),
      cookMinutes: numberOrNull(cookMinutes),
      ingredients,
      instructions,
      tags,
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit(buildInput());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Title *">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Crispy Tofu Peanut Noodles"
          required
        />
      </Field>

      <Field label="Description">
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One line about why this slaps"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Source URL">
          <Input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Source book">
          <Input
            value={sourceBook}
            onChange={(e) => setSourceBook(e.target.value)}
            placeholder="e.g. Veganomicon p. 112"
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Field label="Servings">
          <Input
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </Field>
        <Field label="Prep (min)">
          <Input
            type="number"
            min={0}
            value={prepMinutes}
            onChange={(e) => setPrepMinutes(e.target.value)}
          />
        </Field>
        <Field label="Cook (min)">
          <Input
            type="number"
            min={0}
            value={cookMinutes}
            onChange={(e) => setCookMinutes(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Ingredients (one per line — paste freely)">
        <Textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          rows={8}
          className="font-mono text-[13px]"
          placeholder={"400 g firm tofu, pressed\n3 tbsp soy sauce\n…"}
        />
      </Field>

      <Field label="Instructions (markdown welcome)">
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={12}
          placeholder={"1. Press the tofu…\n\n## Sauce\n- Whisk everything together"}
        />
      </Field>

      <Field label="Tags (comma-separated)">
        <Input
          value={tagText}
          onChange={(e) => setTagText(e.target.value)}
          placeholder="quick weeknight, pasta, 30 minutes"
        />
      </Field>

      {allTags.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              size="xs"
              variant={tags.includes(tag) ? "default" : "neutral"}
              onClick={() => toggleTag(tag)}
              title={tags.includes(tag) ? "Remove tag" : "Add tag"}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}

      {error && <p className="font-base text-[#FF4D50]">⚠️ {error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving || !title.trim()}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
