"use client";

import { Swords, ThumbsUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProjectContext, SwipeDecision } from "@/types/domain";
import { groupByClaim, groupByUse, type LibraryItem, type UseGroupKey } from "./library-groups";
import { SavedPaperCard } from "./saved-paper-card";

const USE_LABELS: Record<UseGroupKey, { title: string; hint: string }> = {
  evidence: { title: "Evidence", hint: "Backs up your argument" },
  counterpoint: { title: "Counterpoints", hint: "Push back on it; address these" },
  method: { title: "Methods", hint: "How others studied it" },
  background: { title: "Background", hint: "Context and definitions" },
  unanalysed: { title: "Not analysed yet", hint: "Saved before analysis finished" },
};

const TITLE_MAX = 60;

/** The design system's focus ring (the shadcn tab ring is 50% alpha, under 3:1 on muted). */
const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
const shorten = (title: string) =>
  title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;

/**
 * Saved papers (LB-01), by use or by claim. Remove records a skip (so the paper doesn't return in
 * the deck); Restore saves it again. Removed cards stay visible this session so Restore is easy.
 */
export function SavedPaperList({
  projectId,
  items,
  claims,
}: {
  projectId: string;
  items: LibraryItem[];
  claims: ProjectContext["claims"];
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion() ?? false;
  const uid = useId();
  // Mirrors `pending` for toast actions, whose closures would otherwise see stale state.
  const inFlight = useRef(new Set<string>());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  // Cards removed this session, kept after the server list drops them (refresh) so they can return.
  const [kept, setKept] = useState<ReadonlyMap<string, LibraryItem>>(new Map());

  const shown = useMemo(() => {
    const ids = new Set(items.map((i) => i.paper.id));
    return [...items, ...[...kept.values()].filter((i) => !ids.has(i.paper.id))];
  }, [items, kept]);
  const byUse = useMemo(() => groupByUse(shown), [shown]);
  const byClaim = useMemo(() => groupByClaim(shown, claims), [shown, claims]);

  const mark = (set: ReadonlySet<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  async function send(item: LibraryItem, decision: SwipeDecision) {
    const id = item.paper.id;
    if (inFlight.current.has(id)) return; // e.g. a toast Undo while the card's request runs
    inFlight.current.add(id);
    const removing = decision === "skip";
    // A teammate's save keeps the paper in the shared library, so only our save goes.
    const staysForTeammate = removing && item.savedByTeammate;
    setPending((p) => mark(p, id, true));
    if (!staysForTeammate) {
      setRemoved((r) => mark(r, id, removing));
      if (removing) setKept((k) => new Map(k).set(id, item));
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/swipes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId: id, decision }),
      });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh(); // exports and the saved count follow the server
      if (staysForTeammate) {
        toast(`Removed your save. “${shorten(item.paper.title)}” stays: a teammate saved it too.`);
      } else if (removing) {
        toast(`Removed “${shorten(item.paper.title)}”`, {
          action: { label: "Undo", onClick: () => void send(item, "save") },
        });
      } else {
        toast(`Restored “${shorten(item.paper.title)}”`);
      }
    } catch {
      if (!staysForTeammate) setRemoved((r) => mark(r, id, !removing));
      toast.error(`Couldn't ${removing ? "remove" : "restore"} “${shorten(item.paper.title)}”`, {
        action: { label: "Retry", onClick: () => void send(item, decision) },
      });
    } finally {
      inFlight.current.delete(id);
      setPending((p) => mark(p, id, false));
    }
  }

  const card = (item: LibraryItem, index: number, headingLevel: 3 | 4 = 3) => {
    const id = item.paper.id;
    const isRemoved = removed.has(id);
    return (
      // Cards deal in one after another (CSS, so they show even before hydration finishes) and
      // the rest glide into place when a removed card shrinks or a restored one grows back.
      <motion.li
        key={id}
        layout={reduceMotion ? false : "position"}
        transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
        className="animate-in duration-300 fill-mode-both fade-in slide-in-from-bottom-2"
        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      >
        <SavedPaperCard
          item={item}
          claims={claims}
          removed={isRemoved}
          pending={pending.has(id)}
          headingLevel={headingLevel}
          onToggle={() => void send(item, isRemoved ? "save" : "skip")}
        />
      </motion.li>
    );
  };

  const byUseView = (
    <div className="flex flex-col gap-8">
      {byUse.map(({ key, items: group }) => (
        <Section
          key={key}
          title={USE_LABELS[key].title}
          hint={USE_LABELS[key].hint}
          count={group.length}
        >
          <ul className="flex flex-col gap-4">{group.map((item, i) => card(item, i))}</ul>
        </Section>
      ))}
    </div>
  );

  if (claims.length === 0) return byUseView;

  return (
    <Tabs defaultValue="use" className="flex flex-col gap-5">
      <TabsList aria-label="Group saved papers" className="h-auto self-start">
        <TabsTrigger value="use" className={`min-h-11 px-4 ${FOCUS_RING}`}>
          By use
        </TabsTrigger>
        <TabsTrigger value="claim" className={`min-h-11 px-4 ${FOCUS_RING}`}>
          By claim
        </TabsTrigger>
      </TabsList>
      <TabsContent value="use">{byUseView}</TabsContent>
      <TabsContent value="claim">
        <div className="flex flex-col gap-10">
          {byClaim.map(({ claim, supports, challenges, otherCount }, index) => (
            <section
              key={claim.id}
              aria-labelledby={`${uid}-claim-${index}`}
              className="flex flex-col gap-4"
            >
              <header className="flex flex-col gap-1 border-b border-primary/30 pb-2 hc:border-primary">
                <p className="text-sm font-medium text-muted-foreground">{claim.label}</p>
                <h2
                  id={`${uid}-claim-${index}`}
                  className="font-display text-xl font-semibold text-primary"
                >
                  {claim.text}
                </h2>
              </header>
              <StanceGroup
                icon={<ThumbsUp className="size-4" strokeWidth={1.75} aria-hidden />}
                label="Supports"
                tone="text-supports"
                empty="No saved paper supports this yet."
              >
                {supports.map((item, i) => card(item, i, 4))}
              </StanceGroup>
              <StanceGroup
                icon={<Swords className="size-4" strokeWidth={1.75} aria-hidden />}
                label="Challenges"
                tone="text-challenges"
                empty="No saved paper challenges this yet."
              >
                {challenges.map((item, i) => card(item, i, 4))}
              </StanceGroup>
              {otherCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {otherCount} more {otherCount === 1 ? "paper is" : "papers are"} neutral or
                  unclear on this claim.
                </p>
              )}
            </section>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function Section({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  children: ReactNode;
}) {
  const id = `group-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3 border-b border-primary/30 pb-2 hc:border-primary">
        <h2 id={id} className="font-display text-xl font-semibold text-primary">
          {title}{" "}
          <span className="font-sans text-base font-normal text-muted-foreground">({count})</span>
        </h2>
        <p className="text-right text-sm text-muted-foreground">{hint}</p>
      </header>
      {children}
    </section>
  );
}

function StanceGroup({
  icon,
  label,
  tone,
  empty,
  children,
}: {
  icon: ReactNode;
  label: string;
  tone: string;
  empty: string;
  children: ReactNode[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className={`flex items-center gap-1.5 text-base font-medium ${tone}`}>
        {icon}
        {label} <span className="text-muted-foreground">({children.length})</span>
      </h3>
      {children.length ? (
        <ul className="flex flex-col gap-4">{children}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
