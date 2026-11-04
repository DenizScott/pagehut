# Contributing to PageHut

Thanks for helping. PageHut is a free tool for game designers, so contributions that keep it fast,
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

## Code rules

- TypeScript strict; no `any` unless it is unavoidable and commented.
- Every editor node or mark needs a Markdown mapping in `src/lib/markdown` and a round-trip test.
- Never hardcode the product name. Use `BRAND` (`src/config/brand.ts`) or the `common.app.name`
  translation key.
- UI text always goes through translations, including `aria-label`s.
- Use logical CSS properties (`ms-*`, `pe-*`, `start-*`, `border-e`) so right-to-left languages work.
- Keep every interactive element reachable by keyboard and labeled for screen readers.

## Translations

Translation files are plain JSON in `locales/<lang>/`. English (`en`) is the reference.

1. Copy `locales/en/` to `locales/<your-language>/`.
2. Add the code to `locales` in `src/i18n/routing.ts`, and its native name to `localeNames` in
   `src/components/shell/Preferences.tsx`. For a right-to-left language, also add it to `rtlLocales`.
3. Translate the values; keep the keys and `{placeholders}` unchanged.
4. Run `pnpm i18n:check`. CI fails on missing keys, extra keys or mismatched placeholders.

Game-design terms should read the way designers in your language actually talk. Don't translate
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

## Commits

Small commits with a clear subject line in the imperative mood ("Add toggle block shortcut").
