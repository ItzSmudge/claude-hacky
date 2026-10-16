"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ensureAnonymousSession } from "./ensure-session";

/** Join code of the shared demo project (supabase/seed.sql locally, supabase/demo/prod-demo.sql on prod). */
export const DEMO_JOIN_CODE = "DEMO42";

/**
 * Opens the demo project as a member, so swipes and the library work for guests too (RLS only
 * lets members write). Joining is idempotent; the project id comes back from join_project, so it
 * doesn't matter which id the demo has in each environment.
 */
export function OpenDemoButton({
  variant = "button",
  onDone,
  className,
}: {
  /** "inline" renders as an underlined text link (sidebar empty state). */
  variant?: "button" | "inline";
  onDone?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  // Stays busy until the deck route has committed, not just until push() is called.
  const [navigating, startTransition] = useTransition();
  const busy = joining || navigating;

  async function open() {
    if (busy) return;
    setJoining(true);
    try {
      // A failed sign-in has already shown its own toast; don't add a second one.
      if ((await ensureAnonymousSession()) === "failed") return;
      const { data: projectId, error } = await getSupabaseBrowserClient().rpc("join_project", {
        p_code: DEMO_JOIN_CODE,
      });
      if (error) throw error;
      if (!projectId) {
        toast.error("The demo project isn't available right now.");
        return;
      }
      onDone?.();
      startTransition(() => {
        router.push(`/app/p/${projectId}`);
        router.refresh(); // the shared /app layout's sidebar now lists the demo
      });
    } catch (err) {
      console.error("[demo] join failed", err);
      toast.error("Couldn't open the demo project. Try again.");
    } finally {
      setJoining(false);
    }
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={() => void open()}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        // Focus ring comes from the caller, which knows the surface it sits on.
        className={cn("rounded underline underline-offset-4", className)}
      >
        {busy ? "Opening the demo…" : "Try the demo project"}
      </button>
    );
  }
  return (
    <Button
      onClick={() => void open()}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      className={cn("min-h-11 aria-disabled:opacity-70", className)}
    >
      {busy && (
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {busy ? "Opening the demo…" : "Open demo project"}
    </Button>
  );
}
