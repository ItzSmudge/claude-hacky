"use client";

import { FileText, LoaderCircle, Plus, Upload, X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { ApiError, Project } from "@/lib/api-schemas";
import { cn } from "@/lib/utils";
import type { ProjectContext } from "@/types/domain";
import { ensureAnonymousSession } from "./ensure-session";
import {
  ACCEPTED_BRIEF,
  checkBriefFile,
  contextFromDraft,
  draftFromContext,
  failureKind,
  MAX_CLAIMS,
  titleFromQuestion,
  type ReviewDraft,
} from "./new-project";

// Owner: projects (PR-01). Question + optional brief → reviewed context → the deck.

const NOT_STATED = "not stated";

type Phase =
  | { name: "form" }
  | { name: "creating" }
  | { name: "reading"; withFile: boolean }
  | { name: "review"; draft: ReviewDraft; saving: boolean }
  | { name: "failed"; kind: "file" | "ai"; message: string };

const CARD =
  "flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-paper md:p-6 hc:border-2";
const FIELD_LABEL = "text-sm font-medium text-foreground";

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiError | null;
  return body?.error ?? "Something went wrong.";
}

export function NewProjectCard() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const ids = useId();
  const [question, setQuestion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "form" });
  // Survives "Choose another file", so retries never create a second project.
  const projectId = useRef<string | null>(null);
  // The question the project was created (or last updated) with, so edits reach the server.
  const sentQuery = useRef<string | null>(null);
  const busy = useRef(false);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const submitButton = useRef<HTMLButtonElement>(null);
  const failedMessage = useRef<HTMLDivElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const lastPhase = useRef<Phase["name"]>("form");
  const focusFileNext = useRef(false);

  // Move focus only when the step changes, never on edits within a step (typing would lose it).
  useEffect(() => {
    if (phase.name === lastPhase.current) return;
    lastPhase.current = phase.name;
    if (phase.name === "review") reviewHeading.current?.focus();
    else if (phase.name === "failed") failedMessage.current?.focus();
    else if (phase.name === "form" && focusFileNext.current) fileInput.current?.focus();
    else if (!document.activeElement || document.activeElement === document.body) {
      submitButton.current?.focus();
    }
    focusFileNext.current = false;
  }, [phase.name]);

  /** An invalid file isn't kept: the drop zone stays, marked invalid, with the reason. */
  function chooseFile(next: File | null) {
    const problem = next && checkBriefFile(next);
    setFile(problem ? null : next);
    setFileError(problem || null);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) chooseFile(dropped);
  }

  async function readBrief(id: string, brief: File | null) {
    setPhase({ name: "reading", withFile: Boolean(brief) });
    const form = new FormData();
    if (brief) form.set("brief", brief);
    try {
      const res = await fetch(`/api/projects/${id}/context`, { method: "POST", body: form });
      if (!res.ok) {
        setPhase({ name: "failed", kind: failureKind(res.status), message: await readError(res) });
        return;
      }
      const { context } = (await res.json()) as { context: ProjectContext };
      setPhase({ name: "review", draft: draftFromContext(context), saving: false });
    } catch {
      setPhase({ name: "failed", kind: "ai", message: "Couldn't read that right now." });
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const query = question.trim();
    if (!query) {
      setQuestionError("Write your research question first.");
      questionInput.current?.focus();
      return;
    }
    busy.current = true;
    try {
      if (!projectId.current) {
        setPhase({ name: "creating" });
        if ((await ensureAnonymousSession()) === "failed") {
          setPhase({ name: "form" });
          return;
        }
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: titleFromQuestion(query), query }),
        });
        if (!res.ok) {
          toast.error(await readError(res));
          setPhase({ name: "form" });
          return;
        }
        projectId.current = ((await res.json()) as Project).id;
        sentQuery.current = query;
      } else if (query !== sentQuery.current) {
        // Back from "Choose another file" with an edited question: the server reads the saved one.
        const res = await fetch(`/api/projects/${projectId.current}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query, title: titleFromQuestion(query) }),
        });
        if (!res.ok) {
          toast.error(await readError(res));
          return;
        }
        sentQuery.current = query;
      }
      await readBrief(projectId.current, file);
    } finally {
      busy.current = false;
    }
  }

  function openDeck() {
    if (!projectId.current) return;
    router.push(`/app/p/${projectId.current}`);
    router.refresh();
  }

  async function startSwiping(draft: ReviewDraft) {
    if (!projectId.current || busy.current) return;
    busy.current = true;
    setPhase({ name: "review", draft, saving: true });
    try {
      const res = await fetch(`/api/projects/${projectId.current}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.topic.trim() || titleFromQuestion(question),
          context: contextFromDraft(draft),
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      openDeck();
    } catch {
      toast.error("Couldn't save your changes. Try again.");
      setPhase({ name: "review", draft, saving: false });
    } finally {
      busy.current = false;
    }
  }

  async function retry(withFile: boolean) {
    if (!projectId.current || busy.current) return;
    busy.current = true;
    try {
      await readBrief(projectId.current, withFile ? file : null);
    } finally {
      busy.current = false;
    }
  }

  if (phase.name === "review") {
    return (
      <ReviewStep
        draft={phase.draft}
        saving={phase.saving}
        headingRef={reviewHeading}
        reduceMotion={Boolean(reduceMotion)}
        onChange={(draft) => setPhase({ name: "review", draft, saving: false })}
        onStart={startSwiping}
      />
    );
  }

  const working = phase.name === "creating" || phase.name === "reading";
  const status =
    phase.name === "reading"
      ? phase.withFile
        ? "Reading your brief…"
        : "Working out what to look for…"
      : phase.name === "creating"
        ? "Starting your project…"
        : "";

  return (
    <article className={CARD}>
      <h2 className="font-display text-2xl font-semibold text-balance text-primary">
        Start a project for your assignment
      </h2>

      {phase.name === "failed" ? (
        <FailedStep
          phase={phase}
          focusRef={failedMessage}
          onChooseAnother={() => {
            chooseFile(null);
            focusFileNext.current = true;
            setPhase({ name: "form" });
          }}
          onWithoutBrief={() => void retry(false)}
          onRetry={() => void retry(true)}
          onQuestionOnly={openDeck}
        />
      ) : (
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${ids}-question`} className={FIELD_LABEL}>
              What are you researching?
            </label>
            <Textarea
              ref={questionInput}
              id={`${ids}-question`}
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                if (questionError) setQuestionError(null);
              }}
              maxLength={2000}
              rows={3}
              disabled={working}
              placeholder="Does heavy social media use harm teenage mental health?"
              aria-invalid={Boolean(questionError)}
              aria-describedby={questionError ? `${ids}-question-error` : undefined}
              className="min-h-24 rounded-xl text-base"
            />
            {questionError && (
              <p id={`${ids}-question-error`} className="text-sm text-destructive">
                {questionError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span id={`${ids}-file-label`} className={FIELD_LABEL}>
              Brief or marking rubric (optional)
            </span>
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2">
                <FileText aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 shrink-0"
                  aria-label={`Remove ${file.name}`}
                  disabled={working}
                  onClick={() => {
                    chooseFile(null);
                    // Same step, so the effect won't run: focus the drop zone once it's back.
                    requestAnimationFrame(() => fileInput.current?.focus());
                  }}
                >
                  <X aria-hidden strokeWidth={1.75} />
                </Button>
              </div>
            ) : (
              <label
                htmlFor={`${ids}-file`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border px-4 py-5 text-center transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-card hover:bg-muted",
                  dragging && "border-primary bg-muted",
                )}
              >
                <Upload aria-hidden className="size-5 text-primary" strokeWidth={1.75} />
                <span className="text-sm font-medium text-primary">
                  Choose a file or drop it here
                </span>
                <span id={`${ids}-file-hint`} className="text-sm text-muted-foreground">
                  PDF, Word or text, up to 4 MB
                </span>
                {/* Inside the label, so the drop zone shows the focus ring (focus-within). */}
                <input
                  ref={fileInput}
                  id={`${ids}-file`}
                  type="file"
                  accept={ACCEPTED_BRIEF}
                  className="sr-only"
                  aria-labelledby={`${ids}-file-label`}
                  aria-describedby={cn(`${ids}-file-hint`, fileError && `${ids}-file-error`)}
                  aria-invalid={Boolean(fileError)}
                  disabled={working}
                  onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {fileError && (
              <p id={`${ids}-file-error`} role="alert" className="text-sm text-destructive">
                {fileError}
              </p>
            )}
          </div>

          {working && (
            <div className="flex flex-col gap-2" aria-hidden>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {/* aria-disabled, not disabled: a disabled button drops keyboard focus. `busy` guards. */}
          <Button
            ref={submitButton}
            type="submit"
            className="min-h-11 self-start px-5 text-base aria-disabled:opacity-70"
            aria-disabled={working}
          >
            {working && (
              <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
            )}
            {file ? "Read my brief" : "Start project"}
          </Button>
        </form>
      )}

      <p aria-live="polite" className={cn("text-sm text-muted-foreground", !status && "sr-only")}>
        {status}
      </p>
    </article>
  );
}

function FailedStep({
  phase,
  focusRef,
  onChooseAnother,
  onWithoutBrief,
  onRetry,
  onQuestionOnly,
}: {
  phase: Extract<Phase, { name: "failed" }>;
  focusRef: React.RefObject<HTMLDivElement | null>;
  onChooseAnother: () => void;
  onWithoutBrief: () => void;
  onRetry: () => void;
  onQuestionOnly: () => void;
}) {
  const file = phase.kind === "file";
  return (
    <div
      ref={focusRef}
      tabIndex={-1}
      role="alert"
      className="flex flex-col gap-4 rounded-xl outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
    >
      <p className="text-base">{file ? phase.message : "Couldn't read that right now."}</p>
      <div className="flex flex-wrap gap-3">
        <Button className="min-h-11 px-5" onClick={file ? onChooseAnother : onRetry}>
          {file ? "Choose another file" : "Try again"}
        </Button>
        <Button
          variant="secondary"
          className="min-h-11 px-5"
          onClick={file ? onWithoutBrief : onQuestionOnly}
        >
          {file ? "Continue without the brief" : "Continue with just my question"}
        </Button>
      </div>
    </div>
  );
}

function ReviewStep({
  draft,
  saving,
  headingRef,
  reduceMotion,
  onChange,
  onStart,
}: {
  draft: ReviewDraft;
  saving: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  reduceMotion: boolean;
  onChange: (draft: ReviewDraft) => void;
  onStart: (draft: ReviewDraft) => void;
}) {
  const ids = useId();
  const root = useRef<HTMLElement>(null);
  // Adding or removing deletes or creates the focused control; say where focus goes next.
  const focusNext = useRef<string[] | null>(null);
  const set = (patch: Partial<ReviewDraft>, ...focus: string[]) => {
    focusNext.current = focus.length ? focus : null;
    onChange({ ...draft, ...patch });
  };
  const summary = draft.summary.trim();

  useEffect(() => {
    const selectors = focusNext.current;
    focusNext.current = null;
    for (const selector of selectors ?? []) {
      const target = root.current?.querySelector<HTMLElement>(selector);
      if (target) return target.focus();
    }
  }, [draft]);

  const removeClaim = (i: number) => {
    const left = draft.claims.length - 1;
    set(
      { claims: draft.claims.filter((_, j) => j !== i) },
      `[data-claim-remove="${Math.min(i, left - 1)}"]`,
      "[data-add-claim]",
    );
  };
  const removeChip = (list: "themes" | "constraints", i: number) => {
    const left = draft[list].length - 1;
    set(
      { [list]: draft[list].filter((_, j) => j !== i) },
      `[data-chip-remove="${list}-${Math.min(i, left - 1)}"]`,
      "[data-start]",
    );
  };

  return (
    <article ref={root} className={CARD} aria-labelledby={`${ids}-heading`}>
      <h2
        id={`${ids}-heading`}
        ref={headingRef}
        tabIndex={-1}
        className="rounded font-display text-2xl font-semibold text-primary outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        Here&apos;s what we found
      </h2>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-topic`} className={FIELD_LABEL}>
          Topic
        </label>
        <Input
          id={`${ids}-topic`}
          value={draft.topic}
          onChange={(event) => set({ topic: event.target.value })}
          disabled={saving}
          className="h-11 rounded-xl text-base"
        />
      </div>

      {summary && summary.toLowerCase() !== NOT_STATED && (
        <p className="max-w-[65ch] rounded-xl bg-highlight px-3 py-2 text-highlight-foreground hc:border-2 hc:border-primary">
          {summary}
        </p>
      )}

      <fieldset className="flex flex-col gap-3" disabled={saving}>
        <legend className={cn(FIELD_LABEL, "mb-2")}>Claims to test</legend>
        {draft.claims.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No claims yet. Add the points your assignment argues, and every card will say where each
            paper stands.
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {draft.claims.map((claim, i) => (
            <motion.li
              // Claims are edited in place and removed by index; position is their identity.
              key={i}
              className="flex items-start gap-2"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut", delay: reduceMotion ? 0 : i * 0.08 }}
            >
              <Textarea
                data-claim={i}
                aria-label={`Claim ${i + 1}`}
                value={claim}
                rows={2}
                onChange={(event) =>
                  set({ claims: draft.claims.map((c, j) => (j === i ? event.target.value : c)) })
                }
                className="min-h-16 flex-1 rounded-xl text-base"
              />
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0"
                data-claim-remove={i}
                aria-label={`Remove claim ${i + 1}`}
                onClick={() => removeClaim(i)}
              >
                <X aria-hidden strokeWidth={1.75} />
              </Button>
            </motion.li>
          ))}
        </ol>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 self-start"
          data-add-claim
          disabled={draft.claims.length >= MAX_CLAIMS}
          onClick={() =>
            set({ claims: [...draft.claims, ""] }, `[data-claim="${draft.claims.length}"]`)
          }
        >
          <Plus aria-hidden strokeWidth={1.75} />
          Add a claim
        </Button>
      </fieldset>

      <ChipList
        label="Themes"
        list="themes"
        items={draft.themes}
        disabled={saving}
        onRemove={(i) => removeChip("themes", i)}
      />
      <ChipList
        label="Constraints"
        list="constraints"
        items={draft.constraints}
        disabled={saving}
        onRemove={(i) => removeChip("constraints", i)}
      />

      <Button
        data-start
        className="min-h-11 self-start px-5 text-base"
        disabled={saving}
        onClick={() => onStart(draft)}
      >
        {saving && <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />}
        Start swiping
      </Button>
    </article>
  );
}

function ChipList({
  label,
  list,
  items,
  disabled,
  onRemove,
}: {
  label: string;
  list: string;
  items: string[];
  disabled: boolean;
  onRemove: (index: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className={cn(FIELD_LABEL, "font-sans tracking-normal")}>{label}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <li key={`${item}-${i}`} className="max-w-full min-w-0">
            {/* Long themes wrap inside the chip instead of pushing the page wider than a phone. */}
            <Badge
              variant="secondary"
              // overflow-visible: the badge clips by default, which cut off the remove button's focus ring.
              className="h-auto max-w-full justify-start gap-1 overflow-visible rounded-full py-0.5 pr-0.5 pl-3 text-left text-sm whitespace-normal"
            >
              <span className="min-w-0 break-words">{item}</span>
              <Button
                type="button"
                variant="ghost"
                data-chip-remove={`${list}-${i}`}
                className="size-11 rounded-full"
                aria-label={`Remove ${label.toLowerCase().replace(/s$/, "")} ${item}`}
                disabled={disabled}
                onClick={() => onRemove(i)}
              >
                <X aria-hidden strokeWidth={1.75} />
              </Button>
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
