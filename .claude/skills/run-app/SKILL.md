---
name: run-app
description: Launch PaperCut locally (Docker + local Supabase + Next dev server) and screenshot every page at phone size in light and dark, signed in as the demo user. Use when asked to run the app, see what pages look like (especially on mobile), or confirm a UI change works in the real app rather than only in tests.
---

# Run PaperCut and screenshot it

Verified in a cloud (Linux) container. Run everything from the repo or worktree root.

## 1. Docker

Cloud containers ship the Docker CLI with no daemon running. Start one if `docker info` fails:

```bash
docker info >/dev/null 2>&1 || (dockerd >/tmp/dockerd.log 2>&1 &)
timeout 90 bash -c 'until docker info >/dev/null 2>&1; do sleep 1; done'  # cold start can take >30 s
```

## 2. Local Supabase (ports 544xx)

```bash
pnpm db:start
```

- **`StatusDbNotReadyError … container is not ready: starting`.** This is normal after a container restart: Postgres is doing crash recovery, which can take a minute or more. Wait for it to be healthy, then run `pnpm db:start` again:

  ```bash
  timeout 180 bash -c 'until docker ps --format "{{.Names}} {{.Status}}" | grep -q "db_papercut.*(healthy)"; do sleep 3; done'
  pnpm db:start
  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:54421/auth/v1/health   # 200
  ```

- **`supabase_edge_runtime` exits.** That is harmless; the app doesn't use edge functions.
- **Missing seed data or a failed demo login.** Run `pnpm db:reset`.

## 3. Dev server

```bash
(pnpm dev > /tmp/papercut-dev.log 2>&1 &)
timeout 90 bash -c 'until curl -sf -o /dev/null http://localhost:3000; do sleep 1; done'
```

To stop it, run `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill`. Don't use a broad `pkill -f`.

## 4. Screenshots

```bash
node .claude/skills/run-app/screenshots.mjs <out-dir>
```

- It writes `<page>-<light|dark>.png` at iPhone 13 size (390×844) for:
  - `/`
  - `/app`
  - `/app/join/DEMO42`
  - the demo project deck
  - the demo project library
  - `/app/_styleguide`
- It exits 2 with a hint if Supabase isn't running.
- It prints the status and any console errors for each page, and exits 1 if any page returned 4xx/5xx or logged an error.
- Use the scratchpad for `<out-dir>`, not the repo. **Look at the images** before reporting.
- To add a route, append it to `ROUTES` in the script.

What the script handles:

- **Auth.** It signs in as `demo@papercut.local` through the local Supabase REST API (the URL and anon key come from `supabase status -o env`, never from `.env` files). It sets the `@supabase/ssr` cookie (`sb-127-auth-token`, `base64-` + base64url JSON, chunked over 3180 chars).
  - Without the cookie, project pages 404 because the anonymous user isn't a member, so the RLS read returns no project.
- **Swipe deck.** It is shot at viewport size, not full page. Its Skip/Undo/Save bar is `position: fixed`, so a full-page shot draws the bar across the middle of the card.
- **Next dev badge.** The "N" badge overlaps bottom-left controls; the script hides `nextjs-portal`.
- **Playwright.** It isn't a project dependency. The script falls back to the global install, which cloud containers have with Chromium in `/opt/pw-browsers`. Don't run `playwright install` there.

To check something interactive (swiping, opening the detail sheet), copy the script and add `page.click(...)` or `page.keyboard.press("ArrowRight")` before the screenshot.
