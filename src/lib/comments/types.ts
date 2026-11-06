import { z } from "zod";
import { CONFLICT, mergeStructured } from "@/lib/structured-merge";

/**
 * Comments (P5). Each page's threads live in comments/<pageId>.json, next to the page file, so a
 * comment never changes the page's text (and never conflicts with someone typing).
 *
 * Inline threads are anchored by the text they were made on (W3C TextQuoteSelector: the quote plus
 * a little text before and after), not by position. Anchors are found again after edits and
 * syncs; if the quoted text is gone, the thread stays and is shown as detached.
 */

export const anchorSchema = z.object({
  exact: z.string().min(1),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
});
export type Anchor = z.infer<typeof anchorSchema>;

export const commentSchema = z.object({
  id: z.string().min(1),
  /** GitHub login, or "" for comments written in local mode. */
  author: z.string(),
  body: z.string(),
  createdAt: z.number(),
  editedAt: z.number().optional(),
});
export type Comment = z.infer<typeof commentSchema>;

export const threadSchema = z.object({
  id: z.string().min(1),
  /** Absent for page-level comments. */
  anchor: anchorSchema.optional(),
  resolved: z.boolean().optional(),
  comments: z.array(commentSchema),
});
export type Thread = z.infer<typeof threadSchema>;

export const commentsFileSchema = z.object({
  schemaVersion: z.literal(1),
  pageId: z.string(),
  threads: z.array(threadSchema),
});

export interface CommentsRecord {
  pageId: string;
  workspaceId: string;
  threads: Thread[];
  /** Last synced file text and blob sha (github mode). */
  base?: { text: string; sha: string; syncedAt: number };
  updatedAt: number;
}

export const commentsPath = (pageId: string) => `comments/${pageId}.json`;

export function commentsFileText(pageId: string, threads: Thread[]): string {
  return `${JSON.stringify({ schemaVersion: 1, pageId, threads }, null, 2)}\n`;
}

export function parseCommentsFile(text: string): Thread[] {
  try {
    const parsed = commentsFileSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data.threads : [];
  } catch {
    return [];
  }
}

/**
 * Merges two edits of a page's comments. Never gives up: threads and replies merge by id; if the
 * same comment was edited differently on both sides, both texts are kept; if one side resolved a
 * thread while the other replied, the reply reopens it.
 */
export function mergeThreads(base: Thread[], mine: Thread[], theirs: Thread[]): Thread[] {
  const { value } = mergeStructured(base, mine, theirs, (b, m, t, path) => {
    const field = path.at(-1);
    if (field === "body" && typeof m === "string" && typeof t === "string") return `${m}\n\n${t}`;
    if (field === "resolved") return false;
    if (field === "editedAt") return Math.max(Number(m ?? 0), Number(t ?? 0));
    return m ?? t ?? b;
  });
  if (value === CONFLICT) return mine; // unreachable: the resolver always decides
  // A thread with new replies on one side is open again.
  return value.map((th) => {
    const b = base.find((x) => x.id === th.id);
    if (!b || !th.resolved || b.resolved) return th;
    const m = mine.find((x) => x.id === th.id);
    const t = theirs.find((x) => x.id === th.id);
    const count = (x?: Thread) => x?.comments.length ?? 0;
    const replyFromOther = (m?.resolved && !t?.resolved && count(t) > count(b)) || (t?.resolved && !m?.resolved && count(m) > count(b));
    return replyFromOther ? { ...th, resolved: false } : th;
  });
}

/** @logins mentioned in a comment body. */
export function mentions(body: string): string[] {
  return [...new Set([...body.matchAll(/(^|[^\w@/])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/g)].map((m) => m[2].toLowerCase()))];
}
