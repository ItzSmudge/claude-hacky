"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ensureAnonymousSession } from "./ensure-session";

/** Join code of the shared demo project (supabase/seed.sql locally, the RD-02 script on prod). */
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
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      await ensureAnonymousSession();
      const { data: projectId, error } = await getSupabaseBrowserClient().rpc("join_project", {
        p_code: DEMO_JOIN_CODE,
      });
      if (error) throw error;
      if (!projectId) {
        toast.error("The demo project isn't available right now.");
        return;
      }
      onDone?.();
      router.push(`/app/p/${projectId}`);
      router.refresh(); // the sidebar now lists the demo
    } catch (err) {
      console.error("[demo] join failed", err);
      toast.error("Couldn't open the demo project. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={() => void open()}
        aria-disabled={busy || undefined}
        className={cn(
          "rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden",
          className,
        )}
      >
        {busy ? "Opening the demo…" : "Try the demo project"}
      </button>
    );
  }
  return (
    <Button
      onClick={() => void open()}
      aria-disabled={busy || undefined}
      className={cn("min-h-11 aria-disabled:opacity-70", className)}
    >
      {busy && (
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      {busy ? "Opening the demo…" : "Open demo project"}
    </Button>
  );
}
