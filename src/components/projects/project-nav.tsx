"use client";

import { LogOut, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import { OpenDemoButton } from "./open-demo-button";
import type { ProjectListItem } from "./project-list";

const RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden hc:focus-visible:ring-4";
const FOCUS_RING = `${RING} focus-visible:ring-offset-sidebar`;
/** Same ring for controls inside dialogs (offset against the popover surface). */
const DIALOG_RING = `${RING} focus-visible:ring-offset-popover`;

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
  const [dialogError, setDialogError] = useState("");
  // Announced inside the sidebar/sheet: toasts sit outside, where an open dialog hides them.
  const [announcement, setAnnouncement] = useState("");

  // Focus targets after a dialog closes: the item's "…" button, or a neighbour once it's gone.
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const links = useRef(new Map<string, HTMLAnchorElement>());
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const focusAfter = useRef<{ id: string; removed?: boolean; neighbour?: string } | null>(null);

  function restoreFocus() {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (!target) return;
    // Next frame: the list may re-render (refresh) after the dialog closes.
    requestAnimationFrame(() => {
      if (!target.removed) return triggers.current.get(target.id)?.focus();
      const next = target.neighbour && links.current.get(target.neighbour);
      if (next) next.focus();
      else emptyRef.current?.focus();
    });
  }

  function openDialog(project: ProjectListItem, kind: "rename" | "remove") {
    const i = projects.findIndex((p) => p.id === project.id);
    focusAfter.current = { id: project.id, neighbour: (projects[i + 1] ?? projects[i - 1])?.id };
    setDialogError("");
    if (kind === "rename") setRenaming(project);
    else setRemoving(project);
  }

  if (projects.length === 0) {
    return (
      <p ref={emptyRef} tabIndex={-1} className="px-3 text-sm text-muted-foreground outline-hidden">
        No projects yet.{" "}
        <OpenDemoButton variant="inline" onDone={onNavigate} className={FOCUS_RING} /> to see how it
        works.
      </p>
    );
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renaming || busy) return;
    const title = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    if (!title || title === renaming.title) return setRenaming(null);
    setBusy(true);
    setDialogError("");
    try {
      const res = await fetch(`/api/projects/${renaming.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(`Renamed to “${title}”`);
      setAnnouncement(`Renamed to ${title}`);
      setRenaming(null);
      router.refresh();
      onChanged?.();
    } catch {
      setDialogError("Couldn't rename the project. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing || busy) return;
    const owner = removing.ownerId === userId;
    setBusy(true);
    setDialogError("");
    try {
      const res = await fetch(`/api/projects/${removing.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      const done = owner ? `Deleted “${removing.title}”` : `Left “${removing.title}”`;
      toast(done);
      setAnnouncement(done);
      if (focusAfter.current) focusAfter.current.removed = true;
      const wasOpen = pathname.startsWith(`/app/p/${removing.id}`);
      setRemoving(null);
      if (wasOpen) router.push("/app");
      router.refresh();
      onChanged?.();
    } catch {
      setDialogError(
        owner
          ? "Couldn't delete the project. Try again."
          : "Couldn't leave the project. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const removingOwned = removing?.ownerId === userId;
  const closeButton = (
    <DialogClose asChild>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Close"
        className={cn("absolute top-2 right-2 size-11", DIALOG_RING)}
      >
        <X className="size-5" strokeWidth={1.75} aria-hidden />
      </Button>
    </DialogClose>
  );
  const errorLine = dialogError && (
    <p role="alert" className="text-sm font-medium text-destructive">
      {dialogError}
    </p>
  );

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <ul className="flex flex-col gap-1">
        {projects.map((p) => {
          const href = `/app/p/${p.id}`;
          const current = pathname === href || pathname.startsWith(`${href}/`);
          const owner = p.ownerId === userId;
          return (
            <li key={p.id} className="flex items-start gap-1">
              <Link
                href={href}
                ref={(el) => {
                  if (el) links.current.set(p.id, el);
                  else links.current.delete(p.id);
                }}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-xl border-l-4 border-transparent px-3 py-2 transition-colors hover:bg-sidebar-accent",
                  // Not background alone (1.1:1): a primary edge marks the open project.
                  current && "border-primary bg-sidebar-accent font-medium",
                  FOCUS_RING,
                )}
              >
                <span className="line-clamp-2 text-sm text-sidebar-foreground">{p.title}</span>
                <span className="sr-only">, </span>
                <span className="text-xs text-muted-foreground">
                  {plural(p.savedCount, "saved paper")}
                  <span aria-hidden> · </span>
                  <span className="sr-only">, </span>
                  {plural(p.swipeCount, "swipe")}
                </span>
              </Link>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    ref={(el) => {
                      if (el) triggers.current.set(p.id, el);
                      else triggers.current.delete(p.id);
                    }}
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
                      <DropdownMenuItem
                        onSelect={() => openDialog(p, "rename")}
                        className="min-h-11"
                      >
                        <Pencil className="size-4" strokeWidth={1.75} aria-hidden />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => openDialog(p, "remove")}
                        className="min-h-11"
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} aria-hidden />
                        Delete
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onSelect={() => openDialog(p, "remove")} className="min-h-11">
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
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            restoreFocus();
          }}
        >
          {closeButton}
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
                className={cn("min-h-11", DIALOG_RING)}
              />
            </label>
            {errorLine}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" className={cn("min-h-11", DIALOG_RING)}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                aria-disabled={busy || undefined}
                className={cn("min-h-11 aria-disabled:opacity-60", DIALOG_RING)}
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent
          showCloseButton={false}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            restoreFocus();
          }}
        >
          {closeButton}
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
          {errorLine}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" className={cn("min-h-11", DIALOG_RING)}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant={removingOwned ? "destructive" : "default"}
              aria-disabled={busy || undefined}
              className={cn("min-h-11 aria-disabled:opacity-60", DIALOG_RING)}
              onClick={() => void remove()}
            >
              {busy
                ? removingOwned
                  ? "Deleting…"
                  : "Leaving…"
                : removingOwned
                  ? "Delete project"
                  : "Leave project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
