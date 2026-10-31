import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

/**
 * Sign-in form. Registration is invite-only, so there is no sign-up mode —
 * the owner creates accounts via `npm run create-user` or the admin API.
 */
export function SignInForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Something went wrong");
      } else {
        onSuccess?.();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-heading">Email</span>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="h-9"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-heading">Password</span>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
          className="h-9"
        />
      </label>

      {error && (
        <p className="text-xs font-base text-[#FF4D50]">⚠️ {error}</p>
      )}

      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-foreground/50">
        Accounts are invite-only — ask the site owner.
      </p>
    </form>
  );
}
