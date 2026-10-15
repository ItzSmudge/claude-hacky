"use client";

import { Check, Copy, Download } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { citeCommand } from "@/lib/export/latex";
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

/** Library export (LB-03): copy one \cite{} with every key, or download a file per format. */
export function ExportPanel({ projectId, citeKeys }: { projectId: string; citeKeys: string[] }) {
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
        <h3 className="text-sm font-medium text-muted-foreground">Download</h3>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {FORMATS.map(({ format, name, ext, use }) => (
            <li key={format}>
              <a
                href={`/api/export/${projectId}?format=${format}`}
                download
                className="flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium text-foreground">
                    {name} <span className="font-mono text-sm text-muted-foreground">{ext}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{use}</span>
                </span>
                <Download aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The \cite{…} for every saved paper, shown in full so students see exactly what they paste. */
export function CopyCite({ keys }: { keys: string[] }) {
  const command = citeCommand(keys);
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const count = `${keys.length} cite ${keys.length === 1 ? "key" : "keys"}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(`Copied ${count}`);
    } catch {
      // Clipboard blocked (permissions, insecure context): select it for a manual copy instead.
      const code = codeRef.current;
      if (code) window.getSelection()?.selectAllChildren(code);
      toast.error("Couldn't reach the clipboard. The citation is selected: press Ctrl+C to copy.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Cite everything</h3>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <code
          ref={codeRef}
          className="max-h-32 flex-1 overflow-y-auto rounded-xl bg-highlight px-3 py-2 font-mono text-sm wrap-anywhere text-highlight-foreground"
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
        <Button onClick={copy} size="lg" className="rounded-xl px-4">
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
          <span className="sr-only"> {count}</span>
        </Button>
      </div>
    </div>
  );
}
