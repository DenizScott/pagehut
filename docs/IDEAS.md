# Ideas

Feature ideas for game teams that go beyond a general-purpose wiki. They are not scheduled; promising ones move
into a phase plan. Add yours at the bottom.

## Story and world

- **Lore cards with first-mention tracking.** Each character, place or item gets a card. The
  editor underlines the first mention of a card's name on every page, and hovering shows the card.
  This keeps names consistent across a long GDD.
- **Timeline of in-world events.** Story beats can carry an in-world date. A timeline view shows
  contradictions, such as a character appearing after their death.
- **Quest graph from links.** Pages tagged as quests show their `[[links]]` as a dependency graph
  (Mermaid), which reveals unreachable or circular quests.
- **"Where is this used?"** for every mechanic: the levels, items and beats that reference it.

## Design discipline

- **Pillar check on every page.** A small strip that asks "Which pillar does this serve?" with
  one click per pillar. The workspace shows features that serve no pillar, which are scope-cut
  candidates.
- **Cut line in the scope tracker.** Drag one line across the feature list; everything below it is
  visibly "not this milestone".
- **Open questions inbox.** Every `warning` callout that ends with `?` is collected into one list
  per workspace.
- **Decision log block.** A block for decision, options considered, why, date and owner, so
  post-mortems are easy to write.

## Teaching and feedback

- **Teacher review mode.** A read-only share via a public repo or GitHub Pages export, plus a
  rubric template whose comments map to GDD sections.
- **Snapshot for submission.** One button creates a Git tag (for example `submission-1`) and a
  PDF, so grading always references a fixed version.

## Playtesting

- **Playtest session sheet.** Tester profile, build version and observations. Each observation
  links to a mechanic; the mechanic page shows a count of open playtest issues.
- **Balance table formulas.** Small formulas (`=base * 1.15 ^ level`) with a sparkline per row.

## Editor niceties

- **Glossary auto-highlight** for project terms, with definitions on hover.
- **Pseudo-code block** with syntax highlighting tuned for game logic (states, events, timers).
- **Mood board paste**: pasting several images arranges them in a gallery block.
