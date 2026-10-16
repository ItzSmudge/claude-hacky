"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ensureAnonymousSession } from "@/components/projects/ensure-session";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { JoinCodeForm } from "./join-code-form";

type JoinResult =
  { status: "joined"; projectId: string } | { status: "unknown" } | { status: "failed" };

// One join in flight per code, even if the effect runs twice (React dev). Forgotten once settled,
// so Try again (or opening the link again later) really calls join_project again.
const joins = new Map<string, Promise<JoinResult>>();

function joinOnce(code: string): Promise<JoinResult> {
  let join = joins.get(code);
  if (!join) {
    join = (async (): Promise<JoinResult> => {
      try {
        // A failed sign-in has already shown its own toast.
        if ((await ensureAnonymousSession()) === "failed") return { status: "failed" };
        const { data, error } = await getSupabaseBrowserClient().rpc("join_project", {
          p_code: code,
        });
        if (error) throw error;
        return data ? { status: "joined", projectId: data } : { status: "unknown" };
      } catch (err) {
        console.error("[group] join failed", err);
        return { status: "failed" };
      }
    })();
    joins.set(code, join);
    void join.finally(() => joins.delete(code));
  }
  return join;
}

/** /app/join/<code>: joins on arrival (guest session if needed), then opens the project's deck. */
export function JoinProject({ code }: { code: string }) {
  const router = useRouter();
  const [result, setResult] = useState<JoinResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Try again stays mounted (busy) while retrying, so keyboard focus isn't lost.
  const [retrying, setRetrying] = useState(false);
  // Keeps "Joining…" up until the deck route has committed.
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void joinOnce(code).then((r) => {
      if (cancelled) return;
      setRetrying(false);
      if (r.status !== "joined") return setResult(r);
      startTransition(() => {
        router.replace(`/app/p/${r.projectId}`);
        router.refresh(); // the shared /app layout's sidebar now lists the project
      });
    });
    return () => {
      cancelled = true;
    };
  }, [code, attempt, router]);

  if (result?.status === "unknown") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert">
          No project uses the code <span className="font-mono font-medium">{code}</span>. Check it
          with whoever invited you, or type it again.
        </p>
        <JoinCodeForm />
      </div>
    );
  }
  if (result?.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="alert">Couldn&apos;t join the project. Check your connection and try again.</p>
        <Button
          onClick={() => {
            if (retrying) return;
            setRetrying(true);
            setAttempt((n) => n + 1);
          }}
          aria-disabled={retrying || undefined}
          aria-busy={retrying || undefined}
          className="min-h-11 rounded-xl px-5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-disabled:opacity-70"
        >
          {retrying ? "Trying again…" : "Try again"}
        </Button>
      </div>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 text-muted-foreground">
      <LoaderCircle
        className="size-5 animate-spin text-primary motion-reduce:animate-none"
        strokeWidth={1.75}
        aria-hidden
      />
      Joining project <span className="font-mono font-medium text-foreground">{code}</span>…
    </p>
  );
}
