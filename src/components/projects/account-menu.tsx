"use client";

import { LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetEnsureSession } from "./ensure-session";

/**
 * PR-03: guests get "Sign in with Google"; Google users see their name and "Sign out".
 * Signing in starts a separate Google account (so several people can demo a shared project from
 * their own devices); signing out drops back to a fresh guest session.
 */
export function AccountMenu({ name }: { name?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const next = window.location.pathname + window.location.search;
    const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/app/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      console.error("[auth] google sign-in failed", error.status, error.message);
      toast.error("Couldn't start Google sign-in. Try again.");
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) {
      toast.error("Couldn't sign out. Try again.");
      setBusy(false);
      return;
    }
    // The layout re-renders signed out, and EnsureSession starts a fresh guest session.
    resetEnsureSession();
    router.push("/app");
    router.refresh();
    setBusy(false);
  }

  if (name === undefined) {
    return (
      <Button variant="outline" size="sm" className="min-h-11" onClick={signIn} disabled={busy}>
        <LogIn aria-hidden />
        <span className="sm:hidden">Sign in</span>
        <span className="hidden sm:inline">Sign in with Google</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-40 truncate text-sm text-muted-foreground sm:inline">
        {name || "Signed in"}
      </span>
      <Button variant="ghost" size="sm" className="min-h-11" onClick={signOut} disabled={busy}>
        <LogOut aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
