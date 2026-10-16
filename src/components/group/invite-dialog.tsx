"use client";

import { Check, Copy, Share2, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { inviteUrl } from "./join-code";

const RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden hc:focus-visible:ring-4";
const PAGE_RING = `${RING} focus-visible:ring-offset-background`;
const DIALOG_RING = `${RING} focus-visible:ring-offset-popover`;

const noop = () => () => {};
/** The page's origin in the browser; null on the server so both renders match. */
const useOrigin = () =>
  useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => null,
  );
const useCanShare = () =>
  useSyncExternalStore(
    noop,
    () => typeof navigator.share === "function",
    () => false,
  );

/** GR-01: share a project's join code and link so teammates can swipe with you. */
export function InviteDialog({
  code,
  memberCount,
  title,
  groupHref,
}: {
  code: string;
  memberCount: number;
  title: string;
  /** The group reading list (GR-03). */
  groupHref: string;
}) {
  const id = useId();
  const origin = useOrigin();
  const canShare = useCanShare();
  const linkRef = useRef<HTMLInputElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);
  const link = origin ? inviteUrl(origin, code) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      // Reset first so a second copy is announced again by the status region below.
      clearTimeout(copiedTimer.current);
      setCopied(false);
      requestAnimationFrame(() => setCopied(true));
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      linkRef.current?.select();
      toast.error("Couldn't copy. The link is selected: copy it from there.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `Join “${title}” on PaperCut`,
        text: `Swipe through papers with me on PaperCut. Join code: ${code}`,
        url: link,
      });
    } catch (err) {
      // Closing the share sheet rejects with AbortError: not a failure.
      if ((err as Error).name !== "AbortError")
        toast.error("Couldn't open sharing. Copy the link instead.");
    }
  }

  const people =
    memberCount === 1 ? "Only you so far." : `${memberCount} people are in this project.`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="secondary"
          className={cn("min-h-11 shrink-0 rounded-xl border-border px-4", PAGE_RING)}
        >
          <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        // Start on the main action rather than Close.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          copyRef.current?.focus();
        }}
      >
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
        <DialogHeader>
          <DialogTitle>Invite your group</DialogTitle>
          <DialogDescription>
            Anyone with the link or code joins this project and swipes with you. No sign-up needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-1 rounded-2xl bg-secondary px-4 py-5 text-secondary-foreground">
          <span className="text-sm font-medium">Join code</span>
          {/* Read letter by letter: "D E M O 4 2", not a word. */}
          <span className="pl-[0.3em] font-mono text-4xl font-semibold tracking-[0.3em]">
            <span aria-hidden>{code}</span>
            <span className="sr-only">{code.split("").join(" ")}</span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-link`} className="text-sm font-medium">
            Invite link
          </label>
          <Input
            id={`${id}-link`}
            ref={linkRef}
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className={cn("min-h-11 font-mono text-sm", DIALOG_RING)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            ref={copyRef}
            onClick={() => void copy()}
            disabled={!link}
            className={cn("min-h-11 flex-1 rounded-xl px-4", DIALOG_RING)}
          >
            {copied ? (
              <Check className="size-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <Copy className="size-4" strokeWidth={1.75} aria-hidden />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          {canShare && (
            <Button
              variant="secondary"
              onClick={() => void share()}
              className={cn("min-h-11 flex-1 rounded-xl px-4", DIALOG_RING)}
            >
              <Share2 className="size-4" strokeWidth={1.75} aria-hidden />
              Share…
            </Button>
          )}
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {copied ? "Invite link copied" : ""}
        </p>
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          {people}
          <Link
            href={groupHref}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-xl font-medium text-primary underline underline-offset-4",
              DIALOG_RING,
            )}
          >
            <Users className="size-4" strokeWidth={1.75} aria-hidden />
            Group reading list
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  );
}
