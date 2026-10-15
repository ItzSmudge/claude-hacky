# 06 — Library & export

**Owner:** Dev D
**Owned paths:** `src/components/library`, `src/lib/export`, `src/app/api/export`, `src/app/app/p/[projectId]/library`
**Depends on:** F-10; LB-04 needs AI-05
**Can start with fixtures?** Yes — seed has 5 saved papers in the demo project

- [ ] LB-01 ⚡ Library page: saved papers grouped by `useAs` / stance, remove/restore
- [x] LB-02 (PR #11) ⚡ BibTeX: doi.org content negotiation → fallback code-built entry; stable cite keys (`lastnameYEARword`) + tests
- [x] LB-03 (PR #?) ⚡ LaTeX `thebibliography` + `.bib` download + "copy \cite{}" ; CSV ; Markdown reading list
- [ ] LB-04 Relations view UI (consumes AI-05)
