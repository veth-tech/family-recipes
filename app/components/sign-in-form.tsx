import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

/**
 * Email/password sign-in form with a sign-up toggle. Used in the header
 * dropdown and anywhere an inline "sign in to publish" prompt is needed.
 */
export function SignInForm({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "signin"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: name.trim() || email.split("@")[0],
            });
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
      {mode === "signup" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-heading">Name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Brandon"
            autoComplete="name"
            className="h-9"
          />
        </label>
      )}
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
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={8}
          required
          className="h-9"
        />
      </label>

      {error && (
        <p className="text-xs font-base text-[#FF4D50]">⚠️ {error}</p>
      )}

      <Button type="submit" size="sm" disabled={busy}>
        {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="text-center text-xs text-foreground/60 underline"
      >
        {mode === "signin"
          ? "No account yet? Create one"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
