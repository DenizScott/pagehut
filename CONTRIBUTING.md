# Contributing to PageHut

Thanks for helping. PageHut is a free writing and planning tool for everyone, so contributions that keep it fast,
accessible and free to host matter most.

## Setup

```bash
pnpm install
pnpm exec playwright install chromium   # once, for e2e tests
pnpm dev
```

Before opening a pull request, run:

```bash
pnpm check
```

```bash
pnpm e2e
```

The end-to-end suite fails a test on any console error, uncaught exception or local server error
(`e2e/deep-guard.ts`), so a passing run also means a quiet console.

GitHub Actions (`.github/workflows/ci.yml`) runs the same checks, the production build and the
end-to-end suite on every push to `main` and on every pull request.

## Code rules

- TypeScript strict; no `any` unless it is unavoidable and commented.
- Every editor node or mark needs a Markdown mapping in `src/lib/markdown` and a round-trip test.
- Never hardcode the product name. Use `BRAND` (`src/config/brand.ts`) or the `common.app.name`
  translation key.
- UI text always goes through translations, including `aria-label`s.
- Use logical CSS properties (`ms-*`, `pe-*`, `start-*`, `border-e`) so right-to-left languages work.
- Keep every interactive element reachable by keyboard and labeled for screen readers. When a
  control shows text, its accessible name must start with that text; click targets are at least
  24×24 px. `e2e/p6-a11y.spec.ts` (axe) fails on violations. If you add a screen or dialog, add it
  to that test.
- Load heavy, rarely used UI (dialogs, panels) with `next/dynamic`; see `LazyDialogs.tsx`.
- Don't import `src/lib/markdown/parse` or `serialize` from app code: use
  `loadMarkdown()` / `markdown()` from `src/lib/markdown/runtime.ts`, so the editor core stays
  out of the first bundle.
- Don't change colors without checking contrast in both themes (`docs/design/HANDOFF.md`).

## Translations

Translation files are plain JSON in `locales/<lang>/`. English (`en`) is the reference.

1. Copy `locales/en/` to `locales/<your-language>/`.
2. Add the code to `locales` in `src/i18n/routing.ts`, and its native name to `localeNames` in
   `src/components/shell/Preferences.tsx`. For a right-to-left language, also add it to `rtlLocales`.
3. Translate the values; keep the keys and `{placeholders}` unchanged.
4. Run `pnpm i18n:check`. CI fails on missing keys, extra keys or mismatched placeholders.

Terms should read the way people in your language actually talk; for the game design templates,
use the words game designers use. Don't translate
word by word. Examples for Turkish:

| English | Turkish |
|---|---|
| core loop | çekirdek döngü |
| design pillar | tasarım ilkesi (design pillar) |
| playtest | oyun testi |
| vertical slice | dikey kesit |
| scope | kapsam |

The first time a term appears in a template, give the English term in parentheses. Many teams use
both.

## Project docs

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. Sync and merging are in
[docs/SYNC.md](docs/SYNC.md), deployment in [docs/DEPLOY.md](docs/DEPLOY.md).

## Commits

Small commits with a clear subject line in the imperative mood ("Add toggle block shortcut").
