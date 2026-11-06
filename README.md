# PageHut

A free, open-source workspace for **game design documents** (GDDs). It's built for
students, indie teams, small studios and university classes.

- **Free to use and free to host.** No paid service is required anywhere.
- **Local-first.** Everything works offline in your browser (IndexedDB) with no sign-up.
- **Your files stay yours.** Team workspaces live in a GitHub repository you own, as readable
  Markdown and JSON.
- **Made for games.** GDD templates, design pillars, and databases for mechanics, scope, story
  beats, playtests and balancing ([docs/FEATURES.md](docs/FEATURES.md)).
- **Localized.** Turkish, English and German at launch, with RTL support ready.

## Download

<p>
  <a href="https://github.com/DenizScott/pagehut/releases/latest/download/PageHut-Setup-win-x64.exe"><img alt="Download for Windows" src="https://img.shields.io/badge/Download-Windows%2010%2F11-466D50?style=for-the-badge&logo=windows&logoColor=white"></a>
  <a href="https://github.com/DenizScott/pagehut/releases/latest/download/PageHut-mac-arm64.dmg"><img alt="Download for macOS (Apple Silicon)" src="https://img.shields.io/badge/Download-macOS%20Apple%20Silicon-466D50?style=for-the-badge&logo=apple&logoColor=white"></a>
  <a href="https://github.com/DenizScott/pagehut/releases/latest/download/PageHut-mac-x64.dmg"><img alt="Download for macOS (Intel)" src="https://img.shields.io/badge/Download-macOS%20Intel-466D50?style=for-the-badge&logo=apple&logoColor=white"></a>
  <a href="https://github.com/DenizScott/pagehut/releases/latest/download/PageHut-linux-x86_64.AppImage"><img alt="Download for Linux (AppImage)" src="https://img.shields.io/badge/Download-Linux%20AppImage-466D50?style=for-the-badge&logo=linux&logoColor=white"></a>
</p>

Click, install, open: nothing to set up, no commands, no account. The desktop app carries the
whole of PageHut and runs **on your computer, without an internet connection**; your pages are
saved there. On Debian or Ubuntu you can also use the
[.deb package](https://github.com/DenizScott/pagehut/releases/latest/download/PageHut-linux-amd64.deb). Every version is listed under
[Releases](https://github.com/DenizScott/pagehut/releases).

The installers aren't code-signed yet (a signing certificate costs money every year), so the
system asks once on first start:

- **Windows:** "Windows protected your PC" → **More info** → **Run anyway**.
- **macOS:** right-click PageHut in Applications → **Open** → **Open**.

**Türkçe:** Yukarıdaki düğmeden işletim sistemine uygun dosyayı indir, kur ve aç. Komut
çalıştırmana ya da siteye girmene gerek yok; uygulama tamamen bilgisayarında, internetsiz çalışır.
Windows ilk açılışta uyarırsa **Ek bilgi → Yine de çalıştır**'ı seç. Ekibinle çalışmak için
uygulamada **GitHub ile giriş yap**'a bas, çıkan kısa kodu GitHub'da gir; 8 saat açık kalır.

To work with your team, sign in with GitHub from the app: it shows a short code, you enter it on
github.com, and the app syncs with your repository like the web version at
<https://pagehut.vercel.app>. No password or key is stored in the app; a sign-in lasts 8 hours.

## What works today

- Block editor with a `/` menu, Markdown shortcuts, a formatting toolbar and drag handles. Blocks include callouts, toggles, tables, to-dos, code and images.
- Nested page tree with drag and drop, plus keyboard move commands and a trash you can restore from.
- `[[page links]]` with backlinks, and **Ctrl/Cmd+K** search across every page.
- Design pillars strip shown above every page.
- 14 GDD templates in Turkish, English and German: one-page GDD, full GDD, vertical slice, pitch deck, level design, mechanic spec, economy, UI/UX flow, story bible, character sheet, art bible, technical design, playtest report and post-mortem.
- **Databases:** typed properties (text, number, select, multi-select, checkbox, date, link, person, relation, formula), table, board, gallery, **calendar**, **timeline**, **chart** and **form** views, filters, sorts and **automations**. Seven game templates: mechanics, scope tracker (MoSCoW), production schedule, story beats, playtest log, balance table with formulas and mood board. Teammates' edits merge by row and cell.
- **Comments:** comment on selected text or on the whole page, reply, resolve and @mention teammates (suggested from the repository's collaborators). Comments stay on their text through edits and syncs, and a Mentions inbox lists open comments that mention you. They are stored in `comments/<page>.json`, next to the page.
- Export a page as Markdown or PDF (through the browser print dialog), or the whole workspace as ZIP (repo layout), JSON or **one PDF** with every page.
- Import Markdown files, ZIPs (folders become parent pages), JSON backups or a **Markdown & CSV folder export** from another workspace app: the page tree, links between pages, images and callouts come along, and CSV tables become databases.
- **GitHub:** sign in, save a workspace to a repository (one readable Markdown file per page), push changes as one commit, open a workspace from a repository on another device, and share by adding collaborators. Automatic two-way sync with three-way merge; overlapping edits show a compare / keep mine / keep theirs choice, and every page has a restorable history. Nothing is ever force-pushed. A workspace can live in a `GDD/` folder inside a Unity or Unreal repository.

## Desktop app (for developers)

The source is in [desktop/](desktop/). It bundles the Next.js standalone server and starts it on
`127.0.0.1:47821` when the app opens. To build an installer for the system you're on:

```bash
PAGEHUT_STANDALONE=1 pnpm build
```

```bash
cd desktop && npm install && npm run prepare-server && npm run dist
```

Publishing a GitHub release builds the Windows, macOS and Linux installers and attaches them to
it (`.github/workflows/desktop.yml`).

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
| `pnpm e2e` | End-to-end tests, including the axe accessibility checks (Playwright; run `pnpm exec playwright install chromium` once) |
| `pnpm i18n:check` | Fails on missing, extra or mismatched translation keys |
| `pnpm check` | lint + typecheck + i18n + unit tests |

If a dev server is already running, point the e2e suite at it: `E2E_PORT=3000 pnpm e2e`.

## Accessibility

PageHut aims for WCAG 2.2 AA in Turkish, English and German, in light and dark themes. Every
screen is checked with axe in the test suite, and Lighthouse scores accessibility at 100. If
something doesn't work with your keyboard or screen reader, please open an issue.

## Deploy (free)

- **Vercel (Hobby):** import the repo; no settings needed for local mode.
- **Docker:** `docker build -t pagehut .`, then `docker run -p 3000:3000 pagehut`.
- **Any Node.js host:** `pnpm build && pnpm start`.

Details, GitHub sign-in on your own domain, and a Cloudflare outline:
[docs/DEPLOY.md](docs/DEPLOY.md).

## Project docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is put together
- [docs/SYNC.md](docs/SYNC.md): GitHub sync, merge and conflicts
- [docs/DEPLOY.md](docs/DEPLOY.md): Vercel, Docker, Node.js and Cloudflare
- [docs/FEATURES.md](docs/FEATURES.md): every feature, including the ones hosted tools charge for
- [docs/IDEAS.md](docs/IDEAS.md): feature ideas for game teams
- [docs/LAUNCH-CHECKLIST.md](docs/LAUNCH-CHECKLIST.md): names and handles to register by hand
- [CONTRIBUTING.md](CONTRIBUTING.md): code and translation contributions

## License

[MIT](LICENSE). Use it, change it, host it, teach with it; keep the copyright notice.
