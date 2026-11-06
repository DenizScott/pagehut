export const generalTemplateIds = ["video-script", "blog-post", "newsletter", "meeting-notes", "project-plan", "weekly-plan"] as const;
export type GeneralTemplateId = (typeof generalTemplateIds)[number];

/** Game design templates (GDDs and their parts). */
export const gameTemplateIds = [
  "one-page-gdd",
  "full-gdd",
  "vertical-slice",
  "pitch-deck",
  "level-design",
  "mechanic-spec",
  "economy-balance",
  "ui-ux-flow",
  "narrative-bible",
  "character-sheet",
  "art-bible",
  "technical-design",
  "playtest-report",
  "post-mortem",
] as const;
export type GameTemplateId = (typeof gameTemplateIds)[number];

/** All page templates, general ones first. */
export const templateIds = [...generalTemplateIds, ...gameTemplateIds] as const;
export type TemplateId = (typeof templateIds)[number];

/** content and work are general; plan, design, story and production are game design. */
export type TemplateCategory = "content" | "work" | "plan" | "design" | "story" | "production";

export const templateCategory: Record<TemplateId, TemplateCategory> = {
  "video-script": "content",
  "blog-post": "content",
  newsletter: "content",
  "meeting-notes": "work",
  "project-plan": "work",
  "weekly-plan": "work",
  "one-page-gdd": "plan",
  "full-gdd": "plan",
  "vertical-slice": "plan",
  "pitch-deck": "plan",
  "level-design": "design",
  "mechanic-spec": "design",
  "economy-balance": "design",
  "ui-ux-flow": "design",
  "narrative-bible": "story",
  "character-sheet": "story",
  "art-bible": "story",
  "technical-design": "production",
  "playtest-report": "production",
  "post-mortem": "production",
};

export const templateIcon: Record<TemplateId, string> = {
  "video-script": "🎬",
  "blog-post": "✍️",
  newsletter: "📰",
  "meeting-notes": "🗒️",
  "project-plan": "🎯",
  "weekly-plan": "🗓️",
  "one-page-gdd": "📄",
  "full-gdd": "📚",
  "vertical-slice": "🧪",
  "pitch-deck": "🎤",
  "level-design": "🗺️",
  "mechanic-spec": "⚙️",
  "economy-balance": "⚖️",
  "ui-ux-flow": "🧭",
  "narrative-bible": "📜",
  "character-sheet": "🧝",
  "art-bible": "🎨",
  "technical-design": "🛠️",
  "playtest-report": "🎮",
  "post-mortem": "🔍",
};

export interface TemplateContent {
  title: string;
  description: string;
  /** Canonical Markdown (see docs/ARCHITECTURE.md#markdown-format). */
  markdown: string;
}

export type TemplateSet = Record<TemplateId, TemplateContent>;
/** What en.ts / tr.ts / de.ts hold: the game design templates. */
export type GameTemplateSet = Record<GameTemplateId, TemplateContent>;
