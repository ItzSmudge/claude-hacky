"use client";

import { BookMarked, Layers, Users, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { RollingText } from "@/components/motion/rolling-text";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { countSaved, SWIPES_CHANGED } from "./saved-count";

const RECOUNT_MS = 300;

const TABS: { segment: string | null; label: string; icon: LucideIcon; path: string }[] = [
  { segment: null, label: "Deck", icon: Layers, path: "" },
  { segment: "library", label: "Library", icon: BookMarked, path: "/library" },
  { segment: "group", label: "Group", icon: Users, path: "/group" },
];

/**
 * PR-04: Deck · Library · Group as card-catalogue divider tabs. The Library count is the group's
 * saved papers (raw rows, so a paper whose cached data is broken still counts). It recounts shortly
 * after teammates' saves (Realtime INSERT/UPDATE), after this tab's own swipe writes (undo included,
 * via SWIPES_CHANGED) and on every tab switch, and takes the server's count on each refresh.
 * No Realtime DELETE listener: deletes can't be filtered or RLS-checked, so it would leak every
 * project's swipe keys to every browser.
 */
export function ProjectTabs({
  projectId,
  initialSaved,
}: {
  projectId: string;
  initialSaved: number;
}) {
  const active = useSelectedLayoutSegment();
  const [saved, setSaved] = useState(initialSaved);
  // A server refresh (library remove, group vote) brings a fresh count: take it.
  const [serverSaved, setServerSaved] = useState(initialSaved);
  if (initialSaved !== serverSaved) {
    setServerSaved(initialSaved);
    setSaved(initialSaved);
  }
  const recount = useRef<() => void>(() => {});

  useEffect(() => {
    if (!z.uuid().safeParse(projectId).success) return;
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    let channel: RealtimeChannel | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Only the newest recount may land: an older, slower response must not overwrite it.
    let latest = 0;

    async function run() {
      const seq = ++latest;
      const { data, error } = await supabase
        .from("swipes")
        .select("paper_id")
        .eq("project_id", projectId)
        .eq("decision", "save");
      // On failure keep the last count: the tab never shows an error.
      if (cancelled || seq !== latest || error) return;
      setSaved(countSaved(data));
    }
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void run(), RECOUNT_MS);
    };
    recount.current = schedule;
    const onLocal = (e: Event) => {
      if ((e as CustomEvent<{ projectId: string }>).detail?.projectId === projectId) schedule();
    };
    window.addEventListener(SWIPES_CHANGED, onLocal);

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      const topic = `library-count:${projectId}`;
      // A channel with this topic may still be leaving (fast remount): wait for it to go first.
      const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
      if (stale) await supabase.removeChannel(stale);
      if (cancelled) return;
      const filter = `project_id=eq.${projectId}`;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "swipes", filter },
          schedule,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "swipes", filter },
          schedule,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener(SWIPES_CHANGED, onLocal);
      recount.current = () => {};
      if (channel) void supabase.removeChannel(channel);
    };
  }, [projectId]);

  // Switching tabs is a cheap moment to make sure the count is right.
  useEffect(() => {
    recount.current();
  }, [active]);

  const reduceMotion = useReducedMotion() ?? false;
  const glide = reduceMotion
    ? { duration: 0 }
    : { type: "tween" as const, duration: 0.25, ease: "easeOut" as const };

  return (
    <nav aria-label="Project">
      <ul className="grid grid-cols-3 border-b border-border hc:border-b-2 hc:border-primary">
        {TABS.map(({ segment, label, icon: Icon, path }) => {
          const current = segment === active;
          return (
            <li key={label} className="flex">
              <Link
                href={`/app/p/${projectId}${path}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group/tab relative -mb-px flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-t-xl border border-transparent px-2 text-sm transition-colors duration-150 ease-out focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden motion-reduce:transition-none sm:gap-2",
                  current
                    ? "border-border border-b-card bg-card font-semibold text-primary hc:-mb-0.5 hc:border-2 hc:border-primary hc:border-b-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {current && (
                  // The ink bar glides to the tab you pick (one layoutId shared across tabs).
                  <motion.span
                    aria-hidden
                    layoutId="project-tab-ink"
                    transition={glide}
                    className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-primary"
                  />
                )}
                <Icon
                  className="size-[18px] shrink-0 transition-transform duration-200 ease-out group-hover/tab:-translate-y-0.5 max-[359px]:hidden"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span>{label}</span>
                {segment === "library" && saved > 0 && (
                  <>
                    <span
                      aria-hidden
                      className="min-w-5 rounded-full bg-secondary px-1.5 text-center text-xs font-semibold text-secondary-foreground tabular-nums max-[300px]:hidden hc:border hc:border-primary"
                    >
                      <RollingText value={saved} />
                    </span>
                    <span className="sr-only">, {saved} saved</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
