# Architecture

Status: P6 (polish and release). Every planned phase is built; known limits are listed in each section.

## Overview

```
UI (React, Tailwind)  ->  small stores (Zustand)  ->  storage layer (src/lib/storage)
                                                      +- Dexie / IndexedDB: always the working copy
                                                      +- GitHub remote (src/lib/github, browser -> api.github.com)
Server: Next.js route handlers for the GitHub sign-in exchange and first-run app setup only.
```

The browser is always the working copy; GitHub is the shared copy (see `docs/SYNC.md`). The
server renders the static shell and never stores or sees documents.

## Stack

Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript strict, Tailwind v4,
Tiptap 3 (ProseMirror), Dexie 4, Zod 4, next-intl 4, Vitest, Playwright, pnpm.

Next.js 16 notes for contributors:

- Middleware is now `src/proxy.ts`.
- Pages that read URL params on the client sit inside `<Suspense>` (see `AppShell`).
- Workspace pages export `instant = false`, because their data is loaded on the client from
  IndexedDB.
- Visited pages stay mounted but hidden (React `<Activity>`). In tests, select visible elements
  (`getByRole`), not `getByLabel`.
- The page route component is reused when only the id changes. `PageView` renders nothing until
  the requested page has loaded, so typing can never land in the previous page.

## Source layout

| Path | Purpose |
|---|---|
| `src/config/brand.ts` | Product name and slug: the only place the name lives in code |
| `src/i18n/` | next-intl routing, request config, navigation helpers |
| `locales/<lang>/*.json` | Translations (namespaces: `common`, `editor`, `slash`) |
| `src/lib/model/schemas.ts` | Zod schemas for repo files, plus local record types |
| `src/lib/storage/` | Dexie database, repository functions, legacy-name migration |
| `src/lib/editor/` | Editor schema (extensions) shared by the UI and the Markdown converters |
| `src/lib/markdown/` | Canonical Markdown serializer and parser |
| `src/components/editor/` | Tiptap UI: slash menu, bubble toolbar, drag handle, image view |
| `src/components/shell/` | App shell, sidebar, page tree, page view, dialogs (search, templates, trash, pillars) |
| `src/lib/tree.ts` | Pure page-tree helpers: build, move, keyboard moves, ancestors |
| `src/lib/search.ts` | MiniSearch index over titles and plain text (Turkish-aware) |
| `src/lib/transfer/` | Front matter, ZIP/JSON bundles, import with id remapping, downloads |
| `src/lib/server/` | Server-only auth: GitHub App config, sealed cookies, OAuth/PKCE handlers |
| `src/app/api/auth/*` | Route handlers: `status`, `login`, `callback`, `token`, `logout` |
| `src/lib/github/` | Browser GitHub client: REST wrapper, repo operations (Git Data API), push (`sync.ts`), pull and merge (`pull.ts`), in-memory fake for tests |
| `src/lib/merge.ts` | Line-based three-way merge and diff (node-diff3) |
| `src/lib/database/` | Database types, file format, queries (filter, sort, group), formulas, edits, structural merge |
| `src/lib/page-file.ts` | Page file text <-> content for both kinds of page; picks the right merge |
| `src/components/database/` | Database UI: views, cells, property menu, row dialog |
| `src/lib/comments/`, `src/components/comments/` | Comment threads, text-quote anchors, merge; comments panel and mentions inbox |
| `src/lib/structured-merge.ts` | Three-way merge of JSON data by id and field (databases, comments) |
| `src/templates/` | GDD templates, one file per language (`en.ts`, `tr.ts`, `de.ts`), and database templates (`databases.ts`) |

## Data model

Each page is stored locally as a `PageRecord`:

- `doc`: ProseMirror JSON. This is the lossless working copy the editor loads.
- `markdown`: canonical Markdown, regenerated on every save. This is what will be committed to
  GitHub and exported.
- `dirty` / `base`: sync bookkeeping for P3 (`base` = last synced content and blob SHA).

If serialization ever fails, the `doc` is still saved, so no text is lost.

Repository layout:

```
workspace.json        page tree, settings, pillars, templates (schemaVersion)
pages/<id>.md         YAML front matter + Markdown body (documents and databases)
comments/<id>.json    comment threads of page <id>, anchored by text quotes
assets/<id>-<name>    images and files (warn above 1 MB, refuse above 25 MB)
```

## Databases

A database is a page with `kind: "database"`. It has typed properties, views (table, board,
gallery, each with its own filters, sorts and hidden properties) and rows. Its file is
`pages/<id>.md` like any page, with `type: "database"` in the front matter, so push, pull,
conflicts and history work unchanged. The body has two parts:

- **Readable table.** A GitHub Markdown table, regenerated on every save, so the database reads
  well on github.com.
- **Data block.** A ```pagehut-database``` fence holding one JSON line per property, view and
  row. Rows are sorted by id, not display order, so diffs stay small. Only this block is read
  back.

**Merging** (`src/lib/database/merge.ts`) works by item and field, not by line:

- Two people editing different cells of one row, or adding rows at the same time, never conflict.
- Multi-select values and relations merge as sets.
- An edit beats a delete.
- Only the same cell changed differently on both sides is a conflict. It uses the normal conflict
  banner.

**Formulas** (`src/lib/database/formula.ts`) are arithmetic over number properties, written as
`{Name}`. They are parsed by hand and never use `eval`. Renaming a property updates the
formulas that use it.

Relations store row ids of another database page.

## Comments

Each page's threads are in `comments/<pageId>.json`, not in the page file. Commenting never changes
a page's text, so it never conflicts with someone typing.

- **Anchors.** An inline thread stores the quoted text plus up to 32 characters before and after it
  (W3C TextQuoteSelector), not a position. `lib/comments/anchor.ts` finds the quote again after
  every change, scoring each occurrence by how much of its context still matches. The editor shows
  anchored threads as decorations (`lib/editor/comment-highlights.ts`). If the quoted text is gone,
  the thread is kept and marked as detached.
- **Sync.** Comment files sync like pages: `expectedSha` on push, then a merge on pull
  (`lib/github/comments-sync.ts`). The merge (`mergeThreads`) works by thread and comment id and
  never conflicts:
  - a comment edited differently on both sides keeps both texts;
  - a reply on one side reopens a thread that was resolved on the other.
- **Mentions.** `@login` in a comment body is a mention. Suggestions come from the repository's
  collaborators, or from recent committers if listing collaborators is not allowed. The Mentions
  inbox lists open threads that mention the signed-in user.
- **Known limit.** Comments are not part of ZIP or JSON exports yet. They travel through GitHub.

## folder import

`lib/transfer/folder-export.ts` reads a "Markdown & CSV" folder export, including ZIPs nested inside ZIPs:

- Export ids are dropped from titles, and page folders become the page tree.
- Relative links between exported pages become `[[page:…]]` links.
- Images become assets, and `<aside>` callouts become callouts.
- A CSV becomes a database. `_all.csv` is preferred, and property types are inferred: number,
  checkbox, date, link, select or multi-select, otherwise text. Row pages become subpages of the
  database.

## Markdown format

CommonMark plus GFM tables and strikethrough, with these additions:

| Block or mark | Markdown |
|---|---|
| Underline | `++text++` |
| To-do | `- [ ] task` / `- [x] done` |
| Callout | `:::callout warning` ... `:::` (variants: info, warning, danger, success, idea) |
| Toggle | `:::toggle Summary text` ... `:::` |
| Nested containers | outer fence gets one more colon per level (`::::callout`) |
| Page link | `[[page:<ULID>|Title]]` (the id is the link; the title is a readable hint) |

Known limits, by design (text is never dropped):

- Table cells are flattened to one line, and merged cells are split.
- Toggle summaries are plain text.
- Code marks can't be combined with other marks; Tiptap's `code` excludes them.

Every block type has a round-trip test in `src/lib/markdown/roundtrip.test.ts`. Add one whenever
you add a node or mark.

## Page tree

Pages are a flat list with `parentId` and a fractional `order`. A move changes one record: the new
order is the midpoint between the neighbors. This keeps diffs small once the tree is synced as
`workspace.json`. Trashing a page trashes its subtree with the same timestamp, so a restore brings
the subtree back together. A page whose parent is still in trash is restored to the top level.

## Import and export

The ZIP export uses the planned repository layout (`workspace.json`, `pages/<id>.md` with front
matter, `assets/`), so it can be committed as is. On import, every page gets a fresh id and
`[[page:…]]` links are rewritten. Importing the same file twice never overwrites anything.
Templates fill a page only when it is empty; otherwise they create a new page.

## Saving

`useDebouncedSaver` writes 300 ms after the last change and always flushes on page switch, tab
hide and unload. Each saver reports to the shared status store by id. The top bar shows "Saved
locally" only when no saver is pending.

## Local database names

The IndexedDB database is named after `BRAND.slug` (`pagehut`). On first run,
`migrateLegacyDatabases` copies data from names used by earlier development builds
(`BRAND.legacyDatabaseNames`). It runs only when the current database is empty and never modifies
the old database.

## Design tokens

Colors are CSS variables in `src/app/globals.css`, defined for light and `.dark` and mapped into
Tailwind with `@theme inline`. They follow the design handoff in
[design/HANDOFF.md](design/HANDOFF.md) ("The Quiet Workshop"):

- **Accent.** Moss on cream.
- **Fonts.** Bricolage Grotesque for the UI and headings, Hanken Grotesk for document text, and
  JetBrains Mono for code.

Checked contrast pairs (WCAG AA):

| Pair | Light | Dark |
|---|---|---|
| Body text on canvas | 14.3:1 | 14.2:1 |
| Muted text on canvas | 6.9:1 | 10.2:1 |
| Accent as text on canvas | 7.6:1 (`#365b41`) | 10.4:1 (`#b9d9b7`) |
| Text on accent fill | 5.9:1 | 10.0:1 |
| Control borders on surface (3:1 needed) | 4.0:1 | 4.8:1 |

Glass (blur plus translucent surface) is used only on chrome: the sidebar drawer, menus, dialogs
and toasts. The document canvas is always opaque.

## Accessibility

Target: WCAG 2.2 AA. `e2e/p6-a11y.spec.ts` runs axe (WCAG 2.0–2.2 A/AA rules) over the page,
search, templates, comments, all three database views and the GitHub and trash dialogs, in light
and dark themes and on a phone layout. The suite fails on any violation.

- Every control has a visible label or a translated `aria-label`. When a control shows text, its
  accessible name starts with that text (WCAG 2.5.3).
- Click targets are at least 24×24 px (WCAG 2.5.8). Task-list checkboxes draw a 16 px box inside
  a 24 px target.
- Focus is always visible (`--ring`), dialogs trap focus and return it, and a skip link leads to
  the page.
- State is never shown by color alone (sync status, conflicts, diff lines all have text).

Lighthouse (production build, `/en`): accessibility 100, best practices 100 and SEO 100 on
desktop and mobile; performance 97–98 on desktop.

## Performance

- Dialogs opened by a click (`LazyDialogs`), the editor, database views and the comments panel
  are loaded with `next/dynamic`, so the first paint does not wait for them. Templates are
  fetched when the browser is idle.
- Search stays in the first bundle on purpose: it opens from Ctrl/Cmd+K and people type at once,
  so a lazy dialog would let the first keystrokes land in the page (an e2e test guards this).
- The monospace font is not preloaded; the two text fonts are.
- **Known limit.** Lighthouse's throttled mobile profile scores 75–77, with LCP around 6 s.
  The page title is drawn only after IndexedDB answers, and the Markdown converters (Tiptap
  schema) are still in the first bundle, because the storage and sync layers import them. The
  next step is to load `src/lib/markdown` lazily inside `local-repo.ts`, `page-file.ts` and the
  importers.

## Deployment

See [DEPLOY.md](DEPLOY.md): Vercel, Docker (`Dockerfile`, Next.js standalone output enabled with
`PAGEHUT_STANDALONE=1`), any Node.js host, and an untested Cloudflare (OpenNext) outline.

## Security

GitHub App with `Contents: read/write` + `Metadata: read`, limited to repositories the app is
installed on. Sign-in uses the web flow with `state` and PKCE (S256).

- **Refresh token.** Sealed with AES-256-GCM in an `httpOnly`, `SameSite=Lax` cookie scoped to
  `/api/auth`, and `Secure` on HTTPS (also behind a proxy that sends `X-Forwarded-Proto: https`).
- **Signed out.** `/api/auth/token` answers 200 with `accessToken: null`, so a signed-out
  visit logs no errors.
- **Access token.** Lives about 8 hours. It is handed to the browser once and kept in module
  memory only (`src/lib/github/session.ts`).
- **Token endpoint.** Requires the `x-pagehut-csrf` header and a same-origin `Origin`.
- **Return paths.** Only relative return paths are accepted (no open redirects).
- **Documents.** Go straight between the browser and `api.github.com`; the server never sees them.

Setup steps are in `docs/GITHUB-SETUP.md`.
