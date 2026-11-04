import type { TemplateSet } from "./types";

export const en: TemplateSet = {
  "one-page-gdd": {
    title: "One-page GDD",
    description: "The whole game on one page: pitch, pillars, core loop, scope.",
    markdown: `:::callout idea
Keep this page short enough to read in two minutes. Link out to detailed pages as they grow.
:::

## Pitch

*One sentence: who you play, what you do, why it's fun.*

## Design pillars

1. **Pillar one:** what every feature must support
2. **Pillar two:**
3. **Pillar three:**

## Core loop

1. Explore
2. Collect
3. Upgrade
4. Repeat with a new challenge

## Player and platform

| | |
| --- | --- |
| Genre | |
| Platform | |
| Target player | |
| Session length | |
| Comparable games | |

## Key features

- [ ] Feature one
- [ ] Feature two
- [ ] Feature three

## Scope and risks

:::callout warning
Biggest risk: *what could stop this game from shipping?*
:::
`,
  },
  "full-gdd": {
    title: "Game Design Document",
    description: "Complete GDD structure: vision, gameplay, world, content, production.",
    markdown: `## 1. Vision

### High concept

### Design pillars

1.
2.
3.

### Target audience and platforms

## 2. Gameplay

### Core loop

### Controls

| Action | Keyboard / mouse | Gamepad |
| --- | --- | --- |
| Move | WASD | Left stick |
| Interact | E | A |

### Mechanics

*List the systems; give each complex one its own Mechanic spec page.*

### Progression

### Failure and difficulty

## 3. World and story

### Setting

### Main characters

### Narrative structure

## 4. Content

### Levels

### Enemies and obstacles

### Items

## 5. Art and audio

### Visual style

### Audio direction

## 6. User interface

### HUD

### Menus

## 7. Production

### Milestones

| Milestone | Date | Goal |
| --- | --- | --- |
| Prototype | | Core loop playable |
| Vertical slice | | One polished level |
| Alpha | | All features in |
| Beta | | Content complete |

### Team and roles

:::toggle Open questions
- Question one
:::
`,
  },
  "vertical-slice": {
    title: "Vertical slice plan",
    description: "Scope one polished, representative piece of the game.",
    markdown: `:::callout idea
A vertical slice proves the final quality bar on a small piece of the game: one level, every layer finished.
:::

## Goal

*What question does this slice answer? (e.g. "Is stealth fun at full quality?")*

## What's in

- [ ] Level / area:
- [ ] Mechanics:
- [ ] Enemies:
- [ ] UI screens:
- [ ] Audio:

## What's out

-

## Quality bar

| Layer | Target |
| --- | --- |
| Gameplay | Final feel, tuned |
| Art | Final, or close to final |
| Audio | Final SFX, placeholder music allowed |
| UI | Final layout |

## Success criteria

1. Playtesters finish the slice without help
2.
3.

## Schedule and owners

| Task | Owner | Due |
| --- | --- | --- |
| | | |

:::callout warning
Cut list: what you'll drop first if the slice runs late.
:::
`,
  },
  "pitch-deck": {
    title: "Pitch deck outline",
    description: "Slide-by-slide outline for pitching to publishers, juries or classmates.",
    markdown: `## Slide 1: Title

Game name, one-line hook, key art.

## Slide 2: The hook

*Why will players care? One sentence and one image.*

## Slide 3: Gameplay

Core loop in three steps, plus a GIF or short video.

## Slide 4: Pillars

1.
2.
3.

## Slide 5: Audience and market

| | |
| --- | --- |
| Target player | |
| Comparable games | |
| Platforms | |
| Price point | |

## Slide 6: What makes it different

## Slide 7: Team

## Slide 8: Status and roadmap

- [ ] Prototype
- [ ] Vertical slice
- [ ] Release

## Slide 9: The ask

*What do you need: funding, publishing, feedback, a grade?*

:::callout idea
Rehearse the pitch in under five minutes. Every slide should survive being read in five seconds.
:::
`,
  },
  "level-design": {
    title: "Level design document",
    description: "Layout, beats, encounters and metrics for one level.",
    markdown: `## Overview

| | |
| --- | --- |
| Level | |
| Position in game | e.g. 3 of 10 |
| Play time | |
| New mechanic taught | |
| Mood | |

## Goal of the level

*What does the player learn, feel or achieve here?*

## Flow and beats

1. **Intro:** safe space, introduce the new idea
2. **Practice:** low-risk use of the mechanic
3. **Twist:** the mechanic combined with something known
4. **Climax:**
5. **Reward and exit:**

## Map

![Map sketch](assets/level-map.png)

## Encounters

| # | Location | Enemies | Purpose |
| --- | --- | --- | --- |
| 1 | | | |

## Metrics

| Metric | Value |
| --- | --- |
| Jump height | |
| Corridor width | |
| Cover spacing | |

## Secrets and optional paths

:::callout warning
Checkpoints: mark where the player respawns, and make sure no section takes more than 2 minutes to replay.
:::
`,
  },
  "mechanic-spec": {
    title: "Mechanic spec",
    description: "Rules, inputs, edge cases and tuning values for one mechanic.",
    markdown: `## Summary

*One sentence: what the player does and why.*

## Pillar served

## Rules

1.
2.
3.

## Inputs and feedback

| Input | Result | Feedback (visual / audio / haptic) |
| --- | --- | --- |
| | | |

## States

\`\`\`
Idle -> Charging -> Released -> Cooldown -> Idle
\`\`\`

## Tuning values

| Parameter | Value | Notes |
| --- | --- | --- |
| Cooldown | 1.5 s | |
| Damage | 10 | |

## Edge cases

- What if the player is mid-air?
- What if two players trigger it at once?

## Interactions with other systems

## Open questions

- [ ]
`,
  },
  "economy-balance": {
    title: "Economy and balance sheet",
    description: "Currencies, sources and sinks, prices and progression curves.",
    markdown: `## Currencies

| Currency | Earned by | Spent on | Cap |
| --- | --- | --- | --- |
| Gold | Enemies, chests | Shop, upgrades | |

## Sources and sinks

:::callout idea
Every source needs a sink. If players can only earn, inflation will flatten every decision.
:::

## Progression curve

Experience needed for each level: \`xp(level) = 100 * 1.15 ^ (level - 1)\`

| Level | XP to next | Unlocks |
| --- | --- | --- |
| 1 | 100 | |
| 2 | 115 | |
| 3 | 132 | |

## Prices

| Item | Price | Time to afford |
| --- | --- | --- |
| | | |

## Damage and health

| Unit | HP | Damage | Hits to kill player |
| --- | --- | --- | --- |
| | | | |

:::callout warning
Write down the target: "a new player should buy their first upgrade after about 10 minutes."
:::
`,
  },
  "ui-ux-flow": {
    title: "UI / UX flow",
    description: "Screens, navigation, HUD and accessibility requirements.",
    markdown: `## Screen list

| Screen | Purpose | Reached from |
| --- | --- | --- |
| Title | | Boot |
| Main menu | | Title |
| Settings | | Main menu, pause |
| HUD | | Gameplay |
| Pause | | Gameplay |

## Navigation flow

\`\`\`
Boot -> Title -> Main menu -> Gameplay <-> Pause -> Settings
\`\`\`

## HUD

*What must the player always see? What appears only when needed?*

- Health
- Objective
-

## Input

- [ ] Fully playable with gamepad
- [ ] Fully playable with keyboard only
- [ ] Remappable controls

## Accessibility

- [ ] Subtitles with size and background options
- [ ] Color-blind safe palette (never color alone)
- [ ] Text scaling
- [ ] Reduced motion / screen shake option
- [ ] Hold-to-press alternatives

## Wireframes

![Wireframe](assets/wireframe.png)
`,
  },
  "narrative-bible": {
    title: "Narrative / story bible",
    description: "World, lore, story structure, characters and tone.",
    markdown: `## Premise

*One paragraph: the world, the conflict, the protagonist's goal.*

## Theme and tone

## World

### History

### Places

### Factions

| Faction | Goal | Relationship to player |
| --- | --- | --- |
| | | |

## Story structure

| Act | Beats | Gameplay link |
| --- | --- | --- |
| I. Setup | | |
| II. Confrontation | | |
| III. Resolution | | |

## Characters

*Give each major character a Character sheet and link it here.*

## Narrative delivery

- [ ] Cutscenes
- [ ] In-game dialogue
- [ ] Environmental storytelling
- [ ] Collectible lore

## Canon rules

:::callout warning
Things that are always true in this world. Check new content against them.
:::

1.
`,
  },
  "character-sheet": {
    title: "Character sheet",
    description: "Role, personality, abilities, look and voice of one character.",
    markdown: `![Concept art](assets/character.png)

## Basics

| | |
| --- | --- |
| Name | |
| Role | Protagonist / ally / enemy / NPC |
| Age | |
| First appears | |

## Personality

*Three adjectives, then one sentence about what they want and what they fear.*

## Backstory

## Abilities and stats

| Stat | Value |
| --- | --- |
| Health | |
| Speed | |
| Special ability | |

## Relationships

| Character | Relationship |
| --- | --- |
| | |

## Look and voice

- Silhouette:
- Color palette:
- Voice / speech style:

## Arc

*How do they change from start to end?*
`,
  },
  "art-bible": {
    title: "Art bible",
    description: "Visual style, palettes, references and asset rules.",
    markdown: `## Visual pillars

1.
2.
3.

## Mood board

![Reference](assets/reference-1.png)

## Color

| Use | Colors | Notes |
| --- | --- | --- |
| Player | | Must stand out from every background |
| Enemies | | |
| Interactive objects | | |

## Shapes and silhouettes

*Friendly = round, danger = sharp? Define your shape language.*

## Lighting and camera

## Characters

## Environments

## UI style

## Asset rules

| Asset | Format | Size / poly budget | Naming |
| --- | --- | --- | --- |
| Textures | PNG | 2048² max | T_Name_Type |
| Characters | FBX | | SK_Name |

:::callout warning
Keep files over 1 MB out of this workspace; link to the art repository or drive instead.
:::
`,
  },
  "technical-design": {
    title: "Technical design document",
    description: "Engine, architecture, systems, tools and technical risks.",
    markdown: `## Platform and engine

| | |
| --- | --- |
| Engine | |
| Language | |
| Target platforms | |
| Minimum spec | |
| Target frame rate | |

## Architecture overview

\`\`\`
Input -> Game state -> Systems (AI, physics, combat) -> Rendering / audio
\`\`\`

## Systems

| System | Owner | Status | Notes |
| --- | --- | --- | --- |
| Save / load | | | |
| AI | | | |

## Data and content pipeline

## Tools

## Performance budgets

| Budget | Target |
| --- | --- |
| Frame time | 16.6 ms |
| Memory | |
| Load time | |

## Technical risks

- [ ] Risk:
  - Mitigation:

## Coding standards and version control

:::callout idea
Write down branch names, review rules and how builds are made, so new team members can start on day one.
:::
`,
  },
  "playtest-report": {
    title: "Playtest report",
    description: "Session setup, observations, findings and actions.",
    markdown: `## Session

| | |
| --- | --- |
| Date | |
| Build | |
| Testers | |
| Moderator | |
| Duration | |

## Goals

*What did we want to learn?*

1.

## Observations

| Time | What happened | Severity |
| --- | --- | --- |
| | | Low / Medium / High |

## Quotes

> "…"

## Findings

:::callout warning
Write findings as problems, not solutions: "players miss the exit" rather than "add an arrow".
:::

1.

## Actions

- [ ] Action, owner, due date

## Metrics

| Metric | Result |
| --- | --- |
| Completion rate | |
| Average time | |
| Deaths per level | |
`,
  },
  "post-mortem": {
    title: "Post-mortem",
    description: "What went right, what went wrong and what we'll change.",
    markdown: `## Project summary

| | |
| --- | --- |
| Project | |
| Duration | |
| Team size | |
| Result | |

## Goals vs results

| Goal | Result |
| --- | --- |
| | |

## What went right

1.
2.
3.

## What went wrong

1.
2.
3.

## Scope

*What did we cut, when, and was it the right call?*

## Process and communication

## Lessons for next time

- [ ]
- [ ]

:::callout idea
Keep it blameless: describe decisions and their context, not people.
:::
`,
  },
};
