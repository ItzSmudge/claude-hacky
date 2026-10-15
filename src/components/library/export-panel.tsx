"use client";

import { Check, Copy, Download, LoaderCircle } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { citeCommand } from "@/lib/export/cite-key";
import type { ExportFormat } from "@/lib/api-schemas";

const FORMATS: { format: ExportFormat; name: string; ext: string; use: string }[] = [
  {
    format: "bibtex",
    name: "BibTeX",
    ext: ".bib",
    use: "For BibTeX, biblatex, Overleaf or Zotero",
  },
  {
    format: "latex",
    name: "LaTeX",
    ext: ".tex",
    use: "A thebibliography block to paste into your document",
  },
  { format: "csv", name: "CSV", ext: ".csv", use: "Open in Excel or Google Sheets" },
  {
    format: "markdown",
    name: "Markdown",
    ext: ".md",
    use: "A reading list grouped by how you'll use each paper",
  },
];

/** The design system's focus ring, at full strength (the shared Button's 50% ring is under 3:1). */
const FOCUS_RING =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/** Library export (LB-03): copy one \cite{} with every key, or download a file per format. */
export function ExportPanel({ projectId, citeKeys }: { projectId: string; citeKeys: string[] }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [status, setStatus] = useState("");

  // Fetch instead of a plain download link: BibTeX can take seconds while doi.org answers, and a
  // failed export would otherwise be saved as a file of JSON. Modified clicks stay normal links.
  async function download(
    event: MouseEvent<HTMLAnchorElement>,
    format: ExportFormat,
    name: string,
  ) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    if (busy) return;
    setBusy(format);
    setStatus(`Preparing ${name}…`);
    try {
      const res = await fetch(event.currentTarget.href);
      if (!res.ok) throw new Error(FAILURE_HINT[res.status] ?? "Try again in a moment.");
      const disposition = res.headers.get("content-disposition") ?? "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `references-${format}`;
      saveBlob(await res.blob(), filename);
      setStatus(`${name} downloaded`);
    } catch (error) {
      setStatus("");
      // fetch() itself only throws when offline or the connection drops.
      const hint =
        error instanceof TypeError
          ? "Check your connection and try again."
          : String((error as Error).message);
      toast.error(`Couldn't export ${name}. ${hint}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="export-heading"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-paper md:p-6"
    >
      <h2 id="export-heading" className="font-display text-xl font-semibold text-primary">
        Export
      </h2>
      <CopyCite keys={citeKeys} />
      <div className="flex flex-col gap-2">
        <h3 id="download-heading" className="text-sm font-medium text-muted-foreground">
          Download
        </h3>
        <ul
          aria-labelledby="download-heading"
          className="divide-y divide-border rounded-xl border border-border"
        >
          {FORMATS.map(({ format, name, ext, use }) => (
            <li key={format}>
              <a
                href={`/api/export/${projectId}?format=${format}`}
                download
                onClick={(event) => download(event, format, name)}
                aria-describedby={`export-${format}-use`}
                aria-busy={busy === format || undefined}
                className="flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-busy:cursor-progress [li:first-child>&]:rounded-t-[11px] [li:last-child>&]:rounded-b-[11px]"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-foreground">
                    {name} <span className="font-mono text-sm text-muted-foreground">{ext}</span>
                    <span className="sr-only"> file, downloads</span>
                  </span>
                  <span id={`export-${format}-use`} className="text-sm text-muted-foreground">
                    {busy === format ? `Preparing ${name}…` : use}
                  </span>
                </span>
                {busy === format ? (
                  <LoaderCircle
                    aria-hidden
                    className="size-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Download
                    aria-hidden
                    className="size-5 shrink-0 text-primary"
                    strokeWidth={1.75}
                  />
                )}
              </a>
            </li>
          ))}
        </ul>
        <p role="status" className="sr-only">
          {status}
        </p>
      </div>
    </section>
  );
}

const FAILURE_HINT: Record<number, string> = {
  401: "Your session ended: reload the page, then try again.",
  404: "This project isn't available any more.",
};

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The \cite{…} for every saved paper, shown in full so students see exactly what they paste. */
export function CopyCite({ keys }: { keys: string[] }) {
  const command = citeCommand(keys);
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [copied, setCopied] = useState(false);
  const count = `${keys.length} cite ${keys.length === 1 ? "key" : "keys"}`;

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
      toast.success(`Copied ${count}`);
    } catch {
      // Clipboard blocked (permissions, insecure context): select it for a manual copy instead.
      const code = codeRef.current;
      if (code) window.getSelection()?.selectAllChildren(code);
      toast.error("Couldn't reach the clipboard. The citation is selected: copy it from the box.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Cite everything</h3>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Focusable so keyboard users can scroll a long list of keys. */}
        <code
          ref={codeRef}
          tabIndex={0}
          role="region"
          aria-label="Cite command for all saved papers"
          className={`max-h-32 flex-1 overflow-y-auto rounded-xl bg-highlight px-3 py-2 font-mono text-sm wrap-anywhere text-highlight-foreground outline-none hc:border-2 hc:border-border ${FOCUS_RING}`}
        >
          {/* Line breaks only after commas, so keys stay whole. */}
          {command.split(",").map((part, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <>
                  ,<wbr />
                </>
              )}
              {part}
            </Fragment>
          ))}
        </code>
        <Button onClick={copy} size="lg" className={`h-11 rounded-xl px-4 ${FOCUS_RING}`}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
          <span className="sr-only"> {count}</span>
        </Button>
      </div>
    </div>
  );
}
