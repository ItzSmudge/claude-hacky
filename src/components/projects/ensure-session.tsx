"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// One sign-in per page load, even if the effect runs twice (React dev) or several layouts mount.
// PR-03: reset this to null on sign-out if that ever happens without a full reload.
let signingIn: Promise<SessionResult> | null = null;

export type SessionResult = "created" | "existing" | "failed";

/** Makes sure there is a session: "created" (new guest), "existing", or "failed" (already toasted). */
export function ensureAnonymousSession(): Promise<SessionResult> {
  signingIn ??= (async () => {
    const supabase = getSupabaseBrowserClient();
    // getUser() asks the server, so a stale cookie can't make us skip sign-in.
    const { data } = await supabase.auth.getUser();
    if (data.user) return "existing";
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[auth] anonymous sign-in failed", error.status, error.message);
      // Usually the per-IP anonymous sign-in limit (shared venue Wi-Fi); say so instead of failing silently.
      toast.error("Couldn't start your session. Refresh the page to try again.");
      signingIn = null; // let a later render retry
      return "failed";
    }
    return "created";
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
    void ensureAnonymousSession().then((result) => {
      if (result === "created" && !cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn, router]);

  return null;
}
