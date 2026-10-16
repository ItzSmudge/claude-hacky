"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// One sign-in per page load, even if the effect runs twice (React dev) or several layouts mount.
// PR-03: reset this to null on sign-out if that ever happens without a full reload.
let signingIn: Promise<boolean> | null = null;

/** Resolves true if a new guest session was created, false if one already existed (or it failed). */
export function ensureAnonymousSession(): Promise<boolean> {
  signingIn ??= (async () => {
    const supabase = getSupabaseBrowserClient();
    // getUser() asks the server, so a stale cookie can't make us skip sign-in.
    const { data } = await supabase.auth.getUser();
    if (data.user) return false;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[auth] anonymous sign-in failed", error.status, error.message);
      // Usually the per-IP anonymous sign-in limit (shared venue Wi-Fi); say so instead of failing silently.
      toast.error("Couldn't start your session. Refresh the page to try again.");
      signingIn = null; // let a later render retry
      return false;
    }
    return true;
  })();
  return signingIn;
}

/**
 * "Try it — no signup": every visitor to /app gets an anonymous Supabase session, so searching,
 * saving and the library work straight away (PR-03 can later upgrade it to Google). Runs in the
 * browser only, so crawlers that don't run JS don't create users. Re-renders once signed in.
 */
export function EnsureSession({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (signedIn) return;
    let cancelled = false;
    void ensureAnonymousSession().then((created) => {
      if (created && !cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, router]);

  return null;
}
