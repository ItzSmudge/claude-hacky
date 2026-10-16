# GR-01 — Join code and invite link

**Goal:** a student taps **Invite** and shares a link or a 6-character code. Anyone who opens the link, including on a phone with no account, lands in the same project and can swipe straight away. This is the "group joins from phone" step of the demo.

## User flow

- **Invite (deck page header):** an **Invite** button opens a dialog with:
  - the join code, large and in mono;
  - the invite link `<origin>/app/join/<CODE>` and **Copy link**;
  - **Share…**, where the browser supports the Web Share API (phones);
  - "N people in this project".
- **Open the link (`/app/join/[code]`):** shows "Joining…". The page ensures a guest session, calls `rpc('join_project', { p_code })`, then replaces the URL with `/app/p/<id>` and refreshes so the sidebar lists the project.
- **Enter a code (`/app/join`):** a form with one field. The code is normalised (trimmed, upper case, spaces and dashes dropped), then the page goes to `/app/join/<CODE>`. `/app` links here: "Have a join code?".

## Inputs / outputs

- `normaliseJoinCode(input)` returns `"ABC234"` or `null`. A valid code is 4–12 letters or digits (generated codes are 6; the demo's is `DEMO42`).
- `inviteUrl(origin, code)` returns the absolute link.
- The join code and member count are read on the server as the user (RLS: members can read both).

## Edge cases

| Case                             | What happens                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Malformed code                   | Error message plus the code form; no RPC call                                                |
| Unknown code                     | "No project uses the code X" plus the form                                                   |
| Sign-in fails                    | The session helper toasts; the page shows Try again                                          |
| Already a member                 | Same as joining: `join_project` is idempotent                                                |
| Effect runs twice (React dev)    | The join is shared per code; failed joins can be retried                                     |
| Clipboard blocked                | Toast tells the user to select the link; the link field is a read-only input they can select |
| Project not visible / invalid id | No Invite button (renders nothing)                                                           |

## Out of scope

Presence and live feed (GR-02), compiled list (GR-03), QR code (needs a dependency), regenerating or revoking codes, removing members.
