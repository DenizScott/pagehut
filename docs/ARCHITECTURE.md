# Architecture

Status: P3. Sections marked *(planned)* describe the approved design for later phases.

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
| `src/templates/` | GDD templates, one file per language (`en.ts`, `tr.ts`, `de.ts`) |

## Data model

Each page is stored locally as a `PageRecord`:

- `doc`: ProseMirror JSON. This is the lossless working copy the editor loads.
- `markdown`: canonical Markdown, regenerated on every save. This is what will be committed to
  GitHub and exported.
- `dirty` / `base`: sync bookkeeping for P3 (`base` = last synced content and blob SHA).

If serialization ever fails, the `doc` is still saved, so no text is lost.

Planned repository layout *(P2)*:

```
workspace.json        page tree, settings, pillars, templates (schemaVersion)
pages/<id>.md         YAML front matter + Markdown body
databases/<id>.json   database schema, views and rows (P4)
comments/<id>.json    comment threads anchored by text quotes (P5)
assets/<id>-<name>    images and files (warn above 1 MB, refuse above 25 MB)
```

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

## Security

GitHub App with `Contents: read/write` + `Metadata: read`, limited to repositories the app is
installed on. Sign-in uses the web flow with `state` and PKCE (S256).

- **Refresh token.** Sealed with AES-256-GCM in an `httpOnly`, `SameSite=Lax` cookie scoped to
  `/api/auth`, and `Secure` on HTTPS.
- **Access token.** Lives about 8 hours. It is handed to the browser once and kept in module
  memory only (`src/lib/github/session.ts`).
- **Token endpoint.** Requires the `x-pagehut-csrf` header and a same-origin `Origin`.
- **Return paths.** Only relative return paths are accepted (no open redirects).
- **Documents.** Go straight between the browser and `api.github.com`; the server never sees them.

Setup steps are in `docs/GITHUB-SETUP.md`.
