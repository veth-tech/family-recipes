import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import { authClient, useSession } from "@/lib/auth-client";

export function AppHeader() {
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();

  return (
    <header className="mb-8 flex items-center justify-between border-b-2 border-border pb-4">
      <Link
        to="/"
        className="text-xl font-heading no-underline text-foreground"
      >
        🍳 Family Recipes
      </Link>
      {isPending ? null : session ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">{session.user.name}</span>
          <Button
            variant="neutral"
            size="xs"
            onClick={async () => {
              await authClient.signOut();
              navigate("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      ) : (
        <Button size="xs" onClick={() => navigate("/login")}>
          Sign in
        </Button>
      )}
    </header>
  );
}
