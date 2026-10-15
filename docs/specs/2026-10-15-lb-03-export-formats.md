# LB-03 — LaTeX, CSV and Markdown exports + copy `\cite{}`

## Goal

Every saved set can leave PaperCut in the shape the student needs:

- a `.bib` file (LB-02)
- a LaTeX `thebibliography` block
- a CSV
- a Markdown reading list
- one click to copy `\cite{…}` with all the keys

Bibliographic fields are rendered by code from retrieved metadata; Claude's analysis text appears only as clearly labelled commentary (overview, why it matters, use as).

## User flow

The library page `/app/p/<id>/library` shows the saved count and an **Export** panel:

- **Copy citations:** the `\cite{boer2020social,kelly2018social,…}` string is shown in JetBrains Mono, with a **Copy** button. The button confirms with a toast ("Copied 5 cite keys") and falls back to selecting the text if the clipboard is blocked.
- **Downloads,** one row each with the file extension: BibTeX `.bib`, LaTeX `.tex`, CSV `.csv`, Markdown `.md`. Each links to `GET /api/export/<id>?format=…`.
- **Empty library:** "Nothing saved yet. Swipe right on papers to collect them here," with a link back to the deck. Downloads are hidden.

LB-01 later adds the paper list above the panel and can reuse `citeCommand` / `CopyCite` per paper.

## Inputs / outputs (`src/lib/export`)

- `loadSavedLibrary(supabase, projectId)` → `{ ok: true, library: { title, papers, analyses } } | { ok: false, reason: "not-found" | "error" }`. Shared by the route and the page. Uses RLS as the user, so "not-found" also covers projects the user isn't a member of.
- `citeCommand(keys)` → `\cite{a,b}`, or an empty string if there are no keys.
- `latexBibliography(papers, keys)` → `\begin{thebibliography}{N}` with one `\bibitem{key}` per paper in cite-key order.
  - Each item reads: authors (more than 6 become the first author + `et~al.`), `\newblock` title, `\newblock \emph{venue}`, year, `\newblock \url{https://doi.org/…}` (or the paper's url).
  - Everything is escaped with LB-02's `escapeLatex`. A header comment says `% needs \usepackage{url}`.
- `csvExport(papers, keys, analyses)` → RFC 4180 CSV with a UTF-8 BOM (so Excel opens it correctly) and CRLF line endings.
  - Columns: `cite_key,title,authors,year,venue,doi,url,citations,peer_reviewed,use_as,relevance,why_it_matters,overview`.
  - Authors are joined with `; `.
  - Cells starting with `= + - @` or a tab/CR get a leading `'` to block formula injection.
- `markdownReadingList(title, papers, keys, analyses)` → `# Reading list: <title>`, then sections in the order Evidence, Counterpoints, Background, Methods, Not analysed yet.
  - Within a section, papers are sorted by relevance, highest first.
  - Each paper: `- **Title.** Authors (Year). *Venue.* [doi:…](https://doi.org/…)`, then a `` `key` `` line and a "Why it matters:" line where an analysis exists.
  - Markdown specials in data are escaped.
- **Route:** `latex`, `csv` and `markdown` return attachments `<slug>.tex|csv|md` with content types `application/x-tex`, `text/csv; charset=utf-8` and `text/markdown; charset=utf-8`. Status codes are as in LB-02.

## Edge cases

- **Missing data:** a paper with no analysis is listed under "Not analysed yet", and its CSV analysis columns are empty. No authors, year or venue means those parts are skipped (no stray punctuation). Titles containing `*`, `_`, `[`, `` ` `` or HTML tags are escaped or stripped.
- **Group projects:** papers saved by several members are listed once.
- **Hostile values:** quotes, commas and newlines inside CSV values are quoted; formula-looking titles (`=HYPERLINK(…)`) are neutralised.
- **Empty library:** every format returns a valid empty file: BibTeX and LaTeX are a comment only (an empty `thebibliography` doesn't compile), CSV is the header row, Markdown says "Nothing saved yet."

## Out of scope

- The paper list, remove/restore and grouping UI (LB-01).
- Relations view (LB-04).
- Per-member save counts (GR-03).
- Biblatex/APA styles.

## Review hardening

- Every text value goes through `plainText`: tags stripped, common HTML entities decoded, whitespace collapsed to one line.
- **LaTeX:** Greek letters, common maths symbols and `< > |` are mapped for pdflatex, and invisible characters are dropped. Other scripts need XeLaTeX/LuaLaTeX (noted in the file header).
- **Links:** only http(s) URLs in printable ASCII appear in any export.
- **CSV:** formulas are neutralised also behind leading spaces and in fullwidth form.
