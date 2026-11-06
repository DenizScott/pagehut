# GitHub sync and conflicts

Status: **P3 implemented**: sign-in, connect/open, a workspace in a folder of any repository,
automatic two-way sync, three-way merge, conflict resolution, page history.

## How syncing works today

- **Where.** A workspace lives in one folder of a repository (`repo.dir`, default `PageHut`; game repositories from before folder support move to `GDD`). PageHut
  only reads and writes inside that folder, plus `README.md` when it initializes an empty
  repository.
- **When.** Automatically while the tab is visible:
  - pushes about 5 s after the last edit;
  - pulls every minute, on window focus and when the network comes back.

  The sync button runs a sync at once. Sync pauses while offline, rate limited (until the reset
  time) or signed out.
- **Sync = pull, then push.**
- **Push.** One commit through the Git Data API: blobs, tree, commit, then a ref update with
  `force: false`. Each file carries the blob sha we last synced (`expectedSha`).
  - If teammates pushed other files (for example Unity code), the commit goes on top of theirs.
  - If one of the workspace's own files changed remotely, the push stops (`RemoteChangedError`)
    and the next pull merges it.
  - A ref race (422) is re-checked and retried once.
- **Pull.** Compares every page file with its last synced blob sha:

  | Situation | Result |
  |---|---|
  | Changed only on GitHub | Theirs is taken |
  | Changed on both sides, different lines | Three-way merge (line-based, `node-diff3`); the merged text is pushed next |
  | Database changed on both sides | Merged by row and cell; only the same cell changed differently is a conflict |
  | Comments changed on both sides | Merged by thread and comment; never a conflict (both texts kept if one comment was edited twice) |
  | Changed on both sides, same lines | **Conflict**: local text stays in the editor, theirs is kept in `page.conflict` |
  | Added on GitHub | New local page (and new images under `assets/`) |
  | Deleted on GitHub | Removed locally if untouched; if edited locally, kept and re-added |
  | Deleted locally, edited on GitHub | Restored with their edit (an edit beats a delete) |
  | Moved in the tree on GitHub | Remote position taken, unless the page was also moved locally |
  | Pillars or name changed on GitHub | Taken, unless also changed locally |

- **Typing is never interrupted.** The page open in the editor is postponed while it has unsaved
  changes or was typed in during the last 8 s (`canTouchPage`). Only real input counts (keys,
  input, paste, drop), not editor normalization. Postponed pages are retried soon after typing
  stops. When the open page changes underneath, the editor reloads only once it is idle.
- **Conflicts.** A banner offers *Compare* (line diff), *Keep mine* (theirs becomes the base, so
  the next push replaces it without forcing) and *Keep theirs*. Pages in conflict are left out of
  pushes until resolved; the rest of the workspace keeps syncing.
- **History.** `GET /repos/{o}/{r}/commits?path=` lists versions with author and date, and
  `contents?ref=` shows one. Restoring makes the old text a normal local edit, which the next
  sync commits; history is never rewritten. The page header shows the last editor.
- **Tokens and tabs.** GitHub rotates refresh tokens on every use. Token refreshes are serialized
  across tabs with the Web Locks API, so two tabs never spend the same refresh token.

Tested against an in-memory GitHub (`src/lib/github/fake-github.ts`, which uses real git blob ids)
in unit tests (`sync.test.ts`, `pull.test.ts`, `merge.test.ts`) and through the real UI in
`e2e/p2-github.spec.ts` and `e2e/p3-sync.spec.ts`.

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
