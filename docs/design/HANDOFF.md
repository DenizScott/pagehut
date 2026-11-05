# Design handoff: "The Quiet Workshop"

The design direction comes from the moodboard and handoff produced with
[CHATGPT-DESIGN-PROMPT.md](CHATGPT-DESIGN-PROMPT.md). The tokens are implemented in
`src/app/globals.css`, and the marks live in `src/app/icon.svg` and `src/components/shell/Logo.tsx`.

## Principles

- **Content is the craft.** The document surface is always flat, opaque and readable.
- **Familiar, not generic.** Controls are familiar, and brand details are used sparingly.
- **Trust the process.** GitHub sync, history and conflicts are always visible.

## Type

| Role | Font | Size / line height | Weight | Tracking |
|---|---|---|---|---|
| Page title | Bricolage Grotesque (opsz 42) | 42 / 50 | 700 | -0.035em |
| H1 | Bricolage Grotesque | 30 / 38 | 700 | -0.025em |
| H2 | Bricolage Grotesque | 24 / 32 | 650 | -0.016em |
| H3 | Bricolage Grotesque | 20 / 28 | 650 | -0.012em |
| Body (documents) | Hanken Grotesk | 16 / 27 | 400 | 0 |
| UI small | Bricolage Grotesque | 14 / 21 | 400 | 0 |
| Label | Bricolage Grotesque | 12 / 18 | 650 | 0.015em |
| Code | JetBrains Mono | 13 / 21 | | |

For Arabic, add Noto Sans Arabic (OFL), and test RTL layout and font metrics separately.

## Colors

The light and dark themes have equal priority. Every pair checked in the handoff passes WCAG AA,
for example:

| Pair | Light | Dark |
|---|---|---|
| fg on canvas | 14.3:1 | 14.2:1 |
| fg-muted on canvas | 6.9:1 | 10.2:1 |
| accent-text on canvas | 7.6:1 | 10.4:1 |
| accent-fg on accent | 5.9:1 | 10.0:1 |
| border-control on surface (non-text, 3:1) | 4.0:1 | 4.8:1 |

- **Hairlines.** `--hairline` is for decorative separation only. Inputs, checkboxes and focus use
  `--border-control` or `--ring`.
- **Callouts.** Each callout uses its semantic pair (`--info`, `--warning`, `--danger`,
  `--success`, `--idea` on its `-soft` background). State is never shown by color alone.
- **Brass.** Brass (`--brand-detail`) is decorative only, for example the two lines in the logo.

## Layout and motion

- **Sizes.** Sidebar 264 px, top bar 56 px. The reading column is at most 720 px wide, and wide
  layouts at most 1040 px.
- **Spacing.** Steps of 4, 8, 12, 16, 24, 32, 48 and 64 px.
- **Controls.** Controls are 36 px, primary buttons 40 px, and touch targets at least 44 px.
- **Glass.** Only on the sidebar, menus, dialogs and toasts: `blur(14px) saturate(105%)`. The
  dialog backdrop is `#11191699`.
- **Motion.** Durations are 120, 180 and 260 ms, with easing `cubic-bezier(0.2,0.8,0.2,1)`.
  Reduced motion turns off looping and nonessential animation and keeps text statuses.
- **Sync wording.**
  - *Synced* uses the success color.
  - *Sending…* uses the info color.
  - *N changes to send* uses the warning color.
  - *N pages need a decision* uses the danger color.
  - *Offline* uses the muted text color.
- **Diff view.** Added lines use `--success-soft` and removed lines use `--danger-soft`. Line
  numbers use JetBrains Mono at 13/21.

## Logo: "Folded Shelter"

The mark is a folded page under a small roof: two shapes plus two short lines, legible at 16 px.

- **Colors.** The ink is the accent color and the two lines are brass.
- **Favicon.** `src/app/icon.svg` follows the system theme.
- **In-app mark.** The mark in the app follows the app theme.
- **Wordmark.** The wordmark SVG uses Bricolage Grotesque as live text. Convert it to paths
  before using it outside the app.

**Before launch:** none of the marks have had a trademark or similarity search yet. This is
listed in `docs/LAUNCH-CHECKLIST.md`.
