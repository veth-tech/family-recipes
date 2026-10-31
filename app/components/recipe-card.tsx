import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecipeDTO } from "../../server/services/recipes";

export function RecipeCard({ recipe }: { recipe: RecipeDTO }) {
  const totalMinutes =
    (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="block h-fit no-underline text-foreground"
    >
      <Card
        size="sm"
        className="bg-secondary-background transition-transform hover:-translate-y-1"
      >
        <CardHeader>
          <CardTitle>{recipe.title}</CardTitle>
          {recipe.description && (
            <p className="line-clamp-2 text-sm">{recipe.description}</p>
          )}
        </CardHeader>
        {(totalMinutes > 0 || recipe.servings || recipe.tags.length > 0) && (
          <CardContent className="flex flex-wrap gap-1.5">
            {totalMinutes > 0 && <Badge variant="neutral">⏱ {totalMinutes} min</Badge>}
            {recipe.servings && (
              <Badge variant="neutral">🍽 serves {recipe.servings}</Badge>
            )}
            {recipe.tags.slice(0, 3).map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </CardContent>
        )}
      </Card>
    </Link>
  );
}
