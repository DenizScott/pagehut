# GitHub sync and conflicts (draft)

Status: **draft design**, to be finalized and implemented in phase P3. P0 already stores the
fields this design needs (`dirty`, `base` on every page).

## Goals

1. Never silently lose text.
2. The working copy is always IndexedDB, so the app works offline.
3. GitHub is the shared source of truth. Every push is a readable commit.

## Sign-in (P2)

- GitHub App with `Contents: read & write` and `Metadata: read`, limited to the repos the user picks.
- `/api/auth/login` sets `state` in an httpOnly cookie, and the callback checks it (CSRF).
- The refresh token goes in an encrypted httpOnly, `Secure`, `SameSite=Lax` cookie.
- The access token (8 h) is kept in memory only. It is never written to localStorage and never logged.

## Push

1. Dirty pages are collected after about 5 s of idle time, or when the user asks.
2. One commit is built through the Git Data API: blobs, tree, commit, then a ref update with
   `force: false`.
3. Commit message: `Update "Combat System", "Enemies"`. The author is the signed-in user.
4. On success: `base = { markdown, sha }` and `dirty = false`.

## When the branch moved

For each dirty page, do a three-way merge of `base`, `local` and `remote` (line-based, `node-diff3`):

- **Clean merge:** write the merged result locally, then retry the push.
- **Overlapping changes:** the page enters **conflict**. Both versions stay in IndexedDB. The UI
  offers *Keep mine*, *Keep theirs* and *Compare* (side by side, with manual merge).
- **`workspace.json`:** merged structurally by node id (tree moves and renames), not as text.

## Pull

- Fetch on window focus, and every 60 s while the tab is visible. Use ETag requests; a 304
  doesn't count against the rate limit.
- A page that is not dirty takes the remote version directly. A dirty page goes through the merge
  above.

## Failure modes

| Situation | Behavior |
|---|---|
| Offline | Status shows *offline*; changes queue locally |
| Rate limited | Read `x-ratelimit-reset`; status shows *sync paused until hh:mm* |
| Token expired | Silent refresh; if that fails, ask the user to sign in again (local work is kept) |
| File > 25 MB | Refused before upload, with a message |
| Repo access removed | Workspace becomes read-only locally, and the user can export everything |

## History

`GET /repos/{o}/{r}/commits?path=pages/<id>.md` lists versions with author and date. Restoring a
version creates a new commit; history is never rewritten.

## Real-time editing (later)

The editor loads from and saves through one adapter (`PageRecord.doc`). A Yjs binding
(`y-prosemirror`) can replace it later without changing the UI.
