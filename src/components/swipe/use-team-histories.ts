"use client";

import { useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { authoriseRealtime } from "@/components/group/live-presence";
import {
  applyTeamChange,
  teamDecisionsFrom,
  teamSwipeChange,
  type SwipeSample,
} from "@/lib/ranking";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SwipeDecision } from "@/types/domain";

export type TeamSwipe = { userId: string; paperId: string; decision: SwipeDecision };

/**
 * RK-04: teammates' swipes on this project, one history each, kept live over Realtime so the deck
 * re-ranks as the group swipes. Papers `featuresOf` can't place are left out, as for my own history.
 */
export function useTeamHistories({
  projectId,
  userId,
  initialTeam,
  featuresOf,
}: {
  projectId: string;
  /** Signed-in user; without one there's no group and no subscription. */
  userId?: string;
  initialTeam: TeamSwipe[];
  featuresOf: (paperId: string) => string[] | undefined;
}): SwipeSample[][] {
  const [team, setTeam] = useState(() => teamDecisionsFrom(initialTeam));

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    const onChange = (payload: unknown) => {
      const change = teamSwipeChange(payload, { projectId, me: userId });
      if (change) setTeam((current) => applyTeamChange(current, change));
    };
    void (async () => {
      await authoriseRealtime();
      // A channel with this topic may still be leaving (fast remount): channel() would hand it
      // back and subscribe() would do nothing, so wait for it to go first.
      const topic = `deck-team:${projectId}`;
      const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
      if (stale) await supabase.removeChannel(stale);
      if (cancelled) return;
      const filter = `project_id=eq.${projectId}`;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "swipes", filter },
          onChange,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "swipes", filter },
          onChange,
        )
        // DELETE can't be filtered by column; teamSwipeChange checks the project instead.
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "swipes" }, onChange);
      channel.subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId, userId]);

  return useMemo(
    () =>
      [...team.values()].map((papers) =>
        [...papers].flatMap(([paperId, decision]) => {
          const features = featuresOf(paperId);
          return features ? [{ features, decision }] : [];
        }),
      ),
    [team, featuresOf],
  );
}
