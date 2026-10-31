import { useNavigate } from "react-router";

import { RecipeForm } from "@/components/recipe-form";
import { AppHeader } from "@/components/app-header";
import { SignInForm } from "@/components/sign-in-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
