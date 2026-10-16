"use client";

import { LogOut, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProjectListItem } from "./project-list";

const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-hidden hc:focus-visible:ring-4";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Project history (PR-02), like a chat sidebar: newest first, counts, the open project marked
 * current. Owners rename/delete; members leave. Used in the desktop aside and the mobile sheet.
 */
export function ProjectNav({
  projects,
  userId,
  onNavigate,
  onChanged,
}: {
  projects: ProjectListItem[];
  userId: string | undefined;
  /** Close the mobile sheet after following a link. */
  onNavigate?: () => void;
  /** Refetch after a rename/delete (the mobile sheet); the server list refreshes anyway. */
  onChanged?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [renaming, setRenaming] = useState<ProjectListItem | null>(null);
  const [removing, setRemoving] = useState<ProjectListItem | null>(null);
  const [busy, setBusy] = useState(false);

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No projects yet.{" "}
        <Link
          href="/app"
          onClick={onNavigate}
          className={cn("rounded underline underline-offset-4", FOCUS_RING)}
        >
          Try the demo project
        </Link>{" "}
        to see how it works.
      </p>
    );
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renaming || busy) return;
    const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    if (!title || title === renaming.title) return setRenaming(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${renaming.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(`Renamed to “${title}”`);
      setRenaming(null);
      router.refresh();
      onChanged?.();
    } catch {
      toast.error("Couldn't rename the project. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing || busy) return;
    const owner = removing.ownerId === userId;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${removing.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      toast(owner ? `Deleted “${removing.title}”` : `Left “${removing.title}”`);
      const wasOpen = pathname.startsWith(`/app/p/${removing.id}`);
      setRemoving(null);
      if (wasOpen) router.push("/app");
      router.refresh();
      onChanged?.();
    } catch {
      toast.error(owner ? "Couldn't delete the project." : "Couldn't leave the project.");
    } finally {
      setBusy(false);
    }
  }

  const removingOwned = removing?.ownerId === userId;

  return (
    <>
      <ul className="flex flex-col gap-1">
        {projects.map((p) => {
          const href = `/app/p/${p.id}`;
          const current = pathname === href || pathname.startsWith(`${href}/`);
          const owner = p.ownerId === userId;
          return (
            <li key={p.id} className="group relative flex items-start gap-1">
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-xl px-3 py-2 transition-colors hover:bg-sidebar-accent",
                  current && "bg-sidebar-accent font-medium hc:border-2 hc:border-primary",
                  FOCUS_RING,
                )}
              >
                <span className="line-clamp-2 text-sm text-sidebar-foreground">{p.title}</span>
                <span className="text-xs text-muted-foreground">
                  {plural(p.savedCount, "saved paper")} · {plural(p.swipeCount, "swipe")}
                </span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Options for ${p.title}`}
                    className={cn("size-11 shrink-0 rounded-xl", FOCUS_RING)}
                  >
                    <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {owner ? (
                    <>
                      <DropdownMenuItem onSelect={() => setRenaming(p)} className="min-h-11">
                        <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setRemoving(p)}
                        className="min-h-11 text-challenges focus:text-challenges"
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onSelect={() => setRemoving(p)} className="min-h-11">
                      <LogOut className="size-4" strokeWidth={1.75} aria-hidden />
                      Leave project
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <form onSubmit={rename} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Rename project</DialogTitle>
              <DialogDescription>
                Only the name changes; your papers stay as they are.
              </DialogDescription>
            </DialogHeader>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Project name
              <Input
                name="title"
                defaultValue={renaming?.title}
                required
                maxLength={200}
                autoFocus
                className="min-h-11"
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => setRenaming(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="min-h-11" aria-disabled={busy || undefined}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {removingOwned ? "Delete this project?" : "Leave this project?"}
            </DialogTitle>
            <DialogDescription>
              {removingOwned
                ? `“${removing?.title}” and its library will be deleted for everyone in it. This can't be undone.`
                : `“${removing?.title}” will disappear from your list. You can rejoin with its join code.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => setRemoving(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={removingOwned ? "destructive" : "default"}
              className="min-h-11"
              aria-disabled={busy || undefined}
              onClick={() => void remove()}
            >
              {removingOwned ? "Delete project" : "Leave project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
