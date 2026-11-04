export const templateIds = [
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

export type TemplateId = (typeof templateIds)[number];

export type TemplateCategory = "plan" | "design" | "story" | "production";

export const templateCategory: Record<TemplateId, TemplateCategory> = {
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
