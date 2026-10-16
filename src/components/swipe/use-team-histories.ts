"use client";

import { useEffect, useMemo, useState } from "react";
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
    const onChange = (payload: unknown) => {
      const change = teamSwipeChange(payload, { projectId, me: userId });
      if (change) setTeam((current) => applyTeamChange(current, change));
    };
    const filter = `project_id=eq.${projectId}`;
    const channel = supabase
      .channel(`deck-team:${projectId}`)
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
    void authoriseRealtime().then(() => {
      if (!cancelled) channel.subscribe();
    });
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
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
