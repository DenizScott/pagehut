# PageHut

A free, open-source, block-based workspace for **game design documents** (GDDs). It's built for
students, indie teams, small studios and university classes.

- **Free to use and free to host.** No paid service is required anywhere.
- **Local-first.** Everything works offline in your browser (IndexedDB) with no sign-up.
- **Your files stay yours.** Team workspaces will live in a GitHub repository you own, as readable
  Markdown and JSON (phase P2).
- **Made for games.** Templates, design pillars, mechanics databases and playtest logs are on the
  roadmap ([docs/FEATURES.md](docs/FEATURES.md)).
- **Localized.** Turkish, English and German at launch, with RTL support ready.

> Status: **P2 (GitHub storage)**. Automatic sync and merging of teammates' changes come in P3.

## What works today

- Block editor with a `/` menu, Markdown shortcuts, a formatting toolbar and drag handles. Blocks include callouts, toggles, tables, to-dos, code and images.
- Nested page tree with drag and drop, plus keyboard move commands and a trash you can restore from.
- `[[page links]]` with backlinks, and **Ctrl/Cmd+K** search across every page.
- Design pillars strip shown above every page.
- 14 GDD templates in Turkish, English and German: one-page GDD, full GDD, vertical slice, pitch deck, level design, mechanic spec, economy, UI/UX flow, story bible, character sheet, art bible, technical design, playtest report and post-mortem.
- Export a page as Markdown or PDF (through the browser print dialog), or the whole workspace as ZIP (repo layout) or JSON.
- Import Markdown files, ZIPs (folders become parent pages) or JSON backups.
- **GitHub:** sign in, save a workspace to a repository (one readable Markdown file per page), push changes as one commit, open a workspace from a repository on another device, and share by adding collaborators. A push never overwrites a teammate's newer commit.

## GitHub sign-in (optional)

Local mode needs no setup. To store workspaces on GitHub, create a free GitHub App and set four environment variables. See [docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md) and copy [.env.example](.env.example) to `.env.local`.

## Run locally

Requirements: Node.js 20+ and pnpm 10+.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The app redirects to your browser language (`/tr`, `/en` or `/de`).
No environment variables are needed for local mode.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generates route types, then runs `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm e2e` | End-to-end tests (Playwright; run `pnpm exec playwright install chromium` once) |
| `pnpm i18n:check` | Fails on missing, extra or mismatched translation keys |
| `pnpm check` | lint + typecheck + i18n + unit tests |

If a dev server is already running, point the e2e suite at it: `E2E_PORT=3000 pnpm e2e`.

## Deploy (free)

- **Vercel (Hobby):** import the repo; no settings needed for local mode.
- **Self-host:** `pnpm build && pnpm start` on any Node.js host.

Cloudflare Pages and Docker guides arrive in P6.

## Project docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is put together
- [docs/SYNC.md](docs/SYNC.md): GitHub sync and conflict design (draft)
- [docs/FEATURES.md](docs/FEATURES.md): every feature
- [docs/IDEAS.md](docs/IDEAS.md): feature ideas for game teams
- [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md): names and handles to register by hand
- [CONTRIBUTING.md](CONTRIBUTING.md): code and translation contributions

## License

To be decided before the first public release (MIT proposed).
