import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

import { AppHeader } from "@/components/app-header";
import { RecipeForm } from "@/components/recipe-form";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import type { RecipeDetailDTO } from "../../server/services/recipes";

export default function EditRecipe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();
  const [recipe, setRecipe] = useState<RecipeDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !id) return;
    api
      .getRecipe(id)
      .then(setRecipe)
      .catch((err) => setError(err.message));
  }, [session, id]);

  if (isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p>Checking session…</p>
      </main>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace />;
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <AppHeader />
      <h1 className="mb-6 text-3xl">Edit: {recipe.title}</h1>
      <RecipeForm
        initial={recipe}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          const updated = await api.updateRecipe(recipe.id, input);
          navigate(`/recipes/${updated.id}`);
        }}
        onCancel={() => navigate(`/recipes/${recipe.id}`)}
      />
    </main>
  );
}
