"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { feedText, presenceText, teammateSave } from "./live";

/**
 * GR-02 on the deck: "3 swiping" while teammates have this project's deck open (Realtime
 * presence), and a single updating toast when one of them saves a paper (Realtime changes on
 * `swipes`, which RLS limits to members).
 */
export function LivePresence({
  projectId,
  me,
  labels,
}: {
  projectId: string;
  me: string;
  /** [userId, "Priya" | "Member N"] for the feed; unknown savers show as "A teammate". */
  labels: [string, string][];
}) {
  const router = useRouter();
  const [keys, setKeys] = useState<string[]>([]);
  // Latest names without re-subscribing whenever the server re-renders the page.
  const names = useRef(new Map(labels));
  useEffect(() => {
    names.current = new Map(labels);
  }, [labels]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const titles = new Map<string, string>();
    let cancelled = false;

    async function announce(row: unknown) {
      const save = teammateSave(row, me);
      if (!save) return;
      let title = titles.get(save.paperId);
      if (!title) {
        const { data } = await supabase
          .from("papers")
          .select("title:data->>title")
          .eq("id", save.paperId)
          .maybeSingle();
        title = typeof data?.title === "string" ? data.title : undefined;
        if (title) titles.set(save.paperId, title);
      }
      if (cancelled) return;
      const who = names.current.get(save.userId) ?? "A teammate";
      // One toast, updated in place, so a busy group doesn't stack them up.
      toast(feedText(who, title), { id: `group-feed-${projectId}` });
    }

    const filter = `project_id=eq.${projectId}`;
    const channel = supabase
      .channel(`project:${projectId}`, { config: { presence: { key: me } } })
      .on("presence", { event: "sync" }, () => {
        if (cancelled) return;
        const now = Object.keys(channel.presenceState());
        setKeys(now);
        // Someone new just joined the project: re-read members so the feed can name them.
        if (now.some((key) => !names.current.has(key))) router.refresh();
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "swipes", filter },
        (p) => void announce(p.new),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "swipes", filter },
        (p) => void announce(p.new),
      );
    void authoriseRealtime().then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ at: new Date().toISOString() });
      });
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [projectId, me, router]);

  const text = presenceText(keys, me);
  return (
    <p
      role="status"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full text-sm font-medium",
        text && "border border-border bg-card px-3 py-1.5 text-card-foreground",
      )}
    >
      {text && (
        <>
          <span aria-hidden className="size-2 rounded-full bg-supports motion-safe:animate-pulse" />
          <span aria-hidden>{text.short}</span>
          <span className="sr-only">{text.long}</span>
        </>
      )}
    </p>
  );
}

/**
 * The cookie-based browser client can open the Realtime socket before it has handed over the
 * user's token, and then RLS sees an anonymous viewer and drops every swipes change. Presence
 * doesn't need it; postgres changes do, so set the token before subscribing.
 */
async function authoriseRealtime() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.realtime.setAuth(data.session.access_token);
}

/** GR-03's list stays current: refresh (debounced) whenever anyone in the project votes. */
export function useLiveRefresh(projectId: string, refresh: () => void) {
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), 400);
    };
    const filter = `project_id=eq.${projectId}`;
    const channel = supabase
      .channel(`group-list:${projectId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "swipes", filter },
        schedule,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "swipes", filter },
        schedule,
      );
    void authoriseRealtime().then(() => {
      if (!cancelled) channel.subscribe();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [projectId]);
}
