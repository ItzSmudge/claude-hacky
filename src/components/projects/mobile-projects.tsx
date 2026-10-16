"use client";

import { FolderOpen } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ProjectListItem } from "./project-list";
import { ProjectNav } from "./project-nav";

type State =
  | { status: "loading" }
  | { status: "ready"; projects: ProjectListItem[]; userId?: string }
  | { status: "error" };

/** Phones: the history sidebar as a sheet. Fetches GET /api/projects each time it opens. */
export function MobileProjects({ userId }: { userId?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "loading" });

  async function load() {
    try {
      const res = await fetch("/api/projects");
      if (res.status === 401) return setState({ status: "ready", projects: [] });
      if (!res.ok) throw new Error(String(res.status));
      const { projects } = (await res.json()) as { projects: ProjectListItem[] };
      setState({ status: "ready", projects, userId });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setState({ status: "loading" });
          void load();
        }
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="min-h-11 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden md:hidden"
        >
          <FolderOpen className="size-5" strokeWidth={1.75} aria-hidden />
          Projects
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-80 max-w-[85vw] gap-4 bg-sidebar p-4 text-sidebar-foreground"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="font-display text-xl text-primary">Your projects</SheetTitle>
          <SheetDescription>Newest first. Saved papers and swipes per project.</SheetDescription>
        </SheetHeader>
        <nav aria-label="Your projects" aria-busy={state.status === "loading"}>
          {state.status === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
          {state.status === "error" && (
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load your projects.{" "}
              <button
                type="button"
                onClick={() => void load()}
                className="min-h-11 rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                Try again
              </button>
            </p>
          )}
          {state.status === "ready" && (
            <ProjectNav
              projects={state.projects}
              userId={userId}
              onNavigate={() => setOpen(false)}
              onChanged={() => void load()}
            />
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
