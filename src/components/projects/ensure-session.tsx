"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

// One sign-in per page load, even if the effect runs twice (React dev) or several layouts mount.
let signingIn: Promise<boolean> | null = null;

function ensureAnonymousSession(): Promise<boolean> {
  signingIn ??= (async () => {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    if (data.session) return false;
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("[auth] anonymous sign-in failed", error.status, error.message);
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
