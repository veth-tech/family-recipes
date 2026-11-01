import { Link } from "react-router";

import { UserMenu } from "@/components/user-menu";

export function AppHeader() {
  return (
    <header className="mb-8 flex items-center justify-between border-b-2 border-border pb-4">
      <Link
        to="/"
        className="text-xl font-heading no-underline text-foreground"
      >
        🌱 Family Recipes
      </Link>
      <UserMenu />
    </header>
  );
}
