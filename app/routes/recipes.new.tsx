import { Navigate, useNavigate } from "react-router";

import { RecipeForm } from "@/components/recipe-form";
import { AppHeader } from "@/components/app-header";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

export default function NewRecipe() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <AppHeader />
      <h1 className="mb-6 text-3xl">New recipe</h1>
      <RecipeForm
        submitLabel="Create recipe"
        onSubmit={async (input) => {
          const recipe = await api.createRecipe(input);
          navigate(`/recipes/${recipe.id}`);
        }}
        onCancel={() => navigate("/")}
      />
    </main>
  );
}
