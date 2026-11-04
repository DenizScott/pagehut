# Architecture

Status: P0. Sections marked *(planned)* describe the approved design for later phases.

## Overview

```
UI (React, Tailwind)  ->  small stores (Zustand)  ->  storage layer (src/lib/storage)
                                                      +- Dexie / IndexedDB: always the working copy
                                                      +- GitHub remote (planned, P2-P3)
Server: Next.js route handlers for the GitHub OAuth exchange only (planned, P2).
```

Everything a user writes lives in the browser until GitHub sync exists. The server renders the
static shell and never stores documents.

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
| `src/components/shell/` | App shell, sidebar, page view, preferences, toasts |

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

Known limits, by design (text is never dropped):

- Table cells are flattened to one line, and merged cells are split.
- Toggle summaries are plain text.
- Code marks can't be combined with other marks; Tiptap's `code` excludes them.

Every block type has a round-trip test in `src/lib/markdown/roundtrip.test.ts`. Add one whenever
you add a node or mark.

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
Tailwind with `@theme inline`. Checked contrast pairs (WCAG AA):

| Pair | Light | Dark |
|---|---|---|
| Body text on canvas | 15.3:1 | 15.1:1 |
| Muted text on canvas | 5.9:1 | 7.1:1 |
| Accent as text | 5.1:1 (`#b4521a`) | 7.8:1 (`#f0915a`) |
| Text on accent fill | 5.9:1 | — |

Glass (blur plus translucent surface) is used only on chrome: the sidebar drawer, menus and toasts.

## Security *(planned, P2)*

GitHub App with fine-grained `Contents: read/write` + `Metadata: read` on repositories the user
picks. The refresh token is kept in an encrypted httpOnly cookie. The short-lived access token is
held in memory only, and the client calls `api.github.com` directly. See the approved plan in
`docs/SYNC.md`.
