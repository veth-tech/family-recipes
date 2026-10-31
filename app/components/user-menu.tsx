import { useState } from "react";

import { SignInForm } from "@/components/sign-in-form";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient, useSession } from "@/lib/auth-client";

/**
 * Top-right account dropdown. Signed out: a "Sign in" button that opens an
 * inline form — no page redirect. Signed in: name menu with sign-out.
 */
export function UserMenu() {
  const { data: session, isPending } = useSession();
  const [open, setOpen] = useState(false);

  if (isPending) {
    return null;
  }

  if (session) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="neutral" size="sm" />}>
          {session.user.name} ▾
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void authClient.signOut()}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button size="sm" />}>
        Sign in
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-4">
        <p className="mb-1 text-sm font-heading">Sign in to publish</p>
        <p className="mb-3 text-xs text-foreground/60">
          Browsing and searching are open to everyone.
        </p>
        <SignInForm onSuccess={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
