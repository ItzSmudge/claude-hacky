"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { RollingText } from "@/components/motion/rolling-text";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { feedSummary, presenceText, teammateSave, type FeedItem } from "./live";

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
    // Unknown presence keys we've already refreshed for: at most one refresh each.
    const asked = new Set<string>();
    let cancelled = false;
    let channel: RealtimeChannel | undefined;

    // Leading + trailing throttle: the first save shows at once, then at most one summary per
    // FEED_MS, so a busy group doesn't flood the toast (and screen readers) with updates.
    let buffer: FeedItem[] = [];
    let cooldown: ReturnType<typeof setTimeout> | undefined;
    const show = (items: FeedItem[]) =>
      toast(feedSummary(items), { id: `group-feed-${projectId}` });
    const flush = () => {
      cooldown = undefined;
      if (cancelled || buffer.length === 0) return;
      show(buffer);
      buffer = [];
      cooldown = setTimeout(flush, FEED_MS);
    };
    const push = (item: FeedItem) => {
      if (cooldown) {
        buffer.push(item);
        return;
      }
      show([item]);
      cooldown = setTimeout(flush, FEED_MS);
    };

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
      push({
        userId: save.userId,
        label: names.current.get(save.userId) ?? "A teammate",
        title,
      });
    }

    void (async () => {
      await authoriseRealtime();
      // A channel with this topic may still be leaving (fast remount): channel() would hand it
      // back and subscribe() would do nothing, so wait for it to go first.
      const stale = supabase.getChannels().find((c) => c.topic === `realtime:project:${projectId}`);
      if (stale) await supabase.removeChannel(stale);
      if (cancelled) return;
      const filter = `project_id=eq.${projectId}`;
      const live = supabase
        .channel(`project:${projectId}`, { config: { presence: { key: me } } })
        .on("presence", { event: "sync" }, () => {
          if (cancelled) return;
          const now = Object.keys(live.presenceState());
          setKeys(now);
          // Someone new joined the project: re-read members once so the feed can name them.
          const fresh = now.filter((key) => !names.current.has(key) && !asked.has(key));
          if (fresh.length) {
            fresh.forEach((key) => asked.add(key));
            router.refresh();
          }
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
      channel = live;
      live.subscribe((status) => {
        if (status === "SUBSCRIBED") void live.track({ at: new Date().toISOString() });
      });
    })();

    return () => {
      cancelled = true;
      clearTimeout(cooldown);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId, me, router]);

  // Only members count: a stray or departed key on the channel isn't "swiping" here.
  const members = new Set(labels.map(([id]) => id));
  const text = presenceText(
    keys.filter((key) => members.has(key)),
    me,
  );
  // Plain text, not a live region: who's around is ambient, and sockets on phones come and go.
  if (!text) return null;
  return (
    <p className="inline-flex shrink-0 animate-in items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-card-foreground duration-200 zoom-in-90 fade-in">
      <span aria-hidden className="size-2 rounded-full bg-supports motion-safe:animate-pulse" />
      <span aria-hidden>
        <RollingText value={text.short} />
      </span>
      <span className="sr-only">{text.long}</span>
    </p>
  );
}

const FEED_MS = 5000;

/**
 * The cookie-based browser client can open the Realtime socket before it has handed over the
 * user's token, and then RLS sees an anonymous viewer and drops every swipes change. Presence
 * doesn't need it; postgres changes do, so set the token before subscribing.
 */
export async function authoriseRealtime() {
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
