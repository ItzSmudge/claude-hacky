# PR-02 — History sidebar, rename/delete, guest sessions

**Goal:** past projects are always one tap away, like chat history, and every visitor to `/app` can use the app without signing up.

## User flow

- **Desktop:** a left sidebar under "Your projects", newest first. Each entry shows the title and "N saved papers · N swipes"; the open project is highlighted and has `aria-current`.
- **Phones:** a **Projects** button in the header opens the same list in a left sheet. It fetches `GET /api/projects` on open, and following a link closes it.
- **"…" menu:**
  - **Owner:** Rename (dialog) or Delete (confirm dialog; deletes the project and its library for everyone).
  - **Member:** Leave project (removes only your membership).
  - If the open project is deleted or left, you go to `/app`.
- **Guest sessions:** if a visitor has no session, `EnsureSession` calls `signInAnonymously()` in the browser once, then refreshes. Crawlers without JS create no users.

## API

| Route                       | Who            | Result                                                                                    |
| --------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/projects`         | signed in      | `{ projects: Project & { savedCount, swipeCount } }` (frozen `projectListResponseSchema`) |
| `PATCH /api/projects/[id]`  | owner          | `updateProjectRequestSchema` → `Project`; 403 for members, 404 if not visible             |
| `DELETE /api/projects/[id]` | owner / member | Owner deletes (cascade); member leaves. 204                                               |

- `savedCount` is distinct papers saved by any member, which matches the library count.
- `swipeCount` is the caller's own swipes.
- All writes run as the user, so RLS stays the final check.

## Edge cases

- No projects: "No projects yet. Try the demo project."
- List load fails: a message on desktop, and Try again in the sheet.
- The anonymous sign-in fails: the error is logged and the next render retries.

## Out of scope

Creating projects (PR-01), Google upgrade (PR-03), join links (GR-01).
