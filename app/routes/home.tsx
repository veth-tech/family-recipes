import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Health = { ok: boolean; service: string; time: string };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err) => setError(String(err)));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <header className="mb-10">
        <h1 className="text-4xl">🍳 Family Recipes</h1>
        <p className="text-foreground/70">Our private vegan recipe library.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>API status</CardTitle>
          <CardDescription>Hono backend on the other side of /api</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          {error ? (
            <p className="font-base text-[#FF4D50]">⚠️ {error}</p>
          ) : health ? (
            <p className="font-base">
              ✅ <span className="font-heading">{health.service}</span> is
              healthy
            </p>
          ) : (
            <p className="font-base">Checking…</p>
          )}
          <a
            href="/docs"
            className={buttonVariants({ variant: "neutral", size: "sm" })}
          >
            API docs
          </a>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button disabled title="Arrives in M2">Add recipe</Button>
        <p className="text-sm text-foreground/60">
          Search, recipes &amp; notes arrive in M2/M3 — see PLAN.md.
        </p>
      </div>
    </main>
  );
}
