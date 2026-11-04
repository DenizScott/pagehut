import type { Editor, Range } from "@tiptap/core";
import { searchKey } from "@/lib/text";

export { searchKey };
import {
  AlertTriangle,
  ChevronRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Link2,
  Lightbulb,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Table,
  Type,
  type LucideIcon,
} from "lucide-react";

export type SlashGroup = "basic" | "structure" | "media";

export interface SlashContext {
  pickImage: (editor: Editor) => void;
}

export interface SlashItemDef {
  id: "text" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "todo" | "toggle" | "quote" | "callout" | "warning" | "idea" | "divider" | "code" | "table" | "image" | "pageLink";
  group: SlashGroup;
  icon: LucideIcon;
  /** English aliases that work in every UI language (people paste habits across tools). */
  aliases: string[];
  run: (editor: Editor, range: Range, ctx: SlashContext) => void;
}

const chain = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

export const slashItems: SlashItemDef[] = [
  { id: "text", group: "basic", icon: Type, aliases: ["text", "p"], run: (e, r) => chain(e, r).setParagraph().run() },
  { id: "h1", group: "basic", icon: Heading1, aliases: ["h1", "heading"], run: (e, r) => chain(e, r).setHeading({ level: 1 }).run() },
  { id: "h2", group: "basic", icon: Heading2, aliases: ["h2", "heading"], run: (e, r) => chain(e, r).setHeading({ level: 2 }).run() },
  { id: "h3", group: "basic", icon: Heading3, aliases: ["h3", "heading"], run: (e, r) => chain(e, r).setHeading({ level: 3 }).run() },
  { id: "bullet", group: "basic", icon: List, aliases: ["bullet", "list", "ul"], run: (e, r) => chain(e, r).toggleBulletList().run() },
  { id: "numbered", group: "basic", icon: ListOrdered, aliases: ["numbered", "list", "ol"], run: (e, r) => chain(e, r).toggleOrderedList().run() },
  { id: "todo", group: "basic", icon: ListChecks, aliases: ["todo", "task", "checkbox"], run: (e, r) => chain(e, r).toggleTaskList().run() },
  {
    id: "pageLink",
    group: "basic",
    icon: Link2,
    aliases: ["link", "page", "mention"],
    // Typing [[ opens the page picker (see page-link-command.ts).
    run: (e, r) => chain(e, r).insertContent("[[").run(),
  },
  { id: "toggle", group: "structure", icon: ChevronRight, aliases: ["toggle", "details"], run: (e, r) => chain(e, r).setDetails().run() },
  { id: "quote", group: "structure", icon: Quote, aliases: ["quote", "blockquote"], run: (e, r) => chain(e, r).toggleBlockquote().run() },
  { id: "callout", group: "structure", icon: Info, aliases: ["callout", "note", "info"], run: (e, r) => chain(e, r).setCallout("info").run() },
  { id: "warning", group: "structure", icon: AlertTriangle, aliases: ["warning", "risk", "callout"], run: (e, r) => chain(e, r).setCallout("warning").run() },
  { id: "idea", group: "structure", icon: Lightbulb, aliases: ["idea", "callout"], run: (e, r) => chain(e, r).setCallout("idea").run() },
  { id: "divider", group: "structure", icon: Minus, aliases: ["divider", "hr", "line"], run: (e, r) => chain(e, r).setHorizontalRule().run() },
  { id: "code", group: "structure", icon: Code, aliases: ["code", "pre"], run: (e, r) => chain(e, r).setCodeBlock().run() },
  { id: "table", group: "structure", icon: Table, aliases: ["table", "grid"], run: (e, r) => chain(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  {
    id: "image",
    group: "media",
    icon: ImageIcon,
    aliases: ["image", "img", "picture"],
    run: (e, r, ctx) => {
      chain(e, r).run();
      ctx.pickImage(e);
    },
  },
];


export interface SlashEntry extends SlashItemDef {
  title: string;
  description: string;
  haystack: string;
}

export function filterSlash(entries: SlashEntry[], query: string, locale: string): SlashEntry[] {
  const q = searchKey(query.trim(), locale);
  if (!q) return entries;
  const words = q.split(/\s+/);
  return entries
    .filter((e) => words.every((w) => e.haystack.includes(w)))
    .sort((a, b) => Number(!searchKey(a.title, locale).startsWith(q)) - Number(!searchKey(b.title, locale).startsWith(q)));
}
