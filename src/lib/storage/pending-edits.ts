import type { DatabaseData } from "@/lib/database/types";
import { getPage, saveDatabase, savePageContent, savePageTitle } from "./local-repo";

/**
 * Edits that were still waiting for their debounced save when the page was closed or reloaded.
 *
 * IndexedDB writes are asynchronous, and a browser may tear the page down before one started in
 * `pagehide` finishes, so the last few keystrokes could be lost. localStorage writes are
 * synchronous: on `pagehide` each saver with a pending value stashes it here, and the next start of
 * the app writes it to IndexedDB (unless the page changed later, e.g. in another tab).
 */

export type PendingKind = "title" | "content" | "database";
const PREFIX = "pagehut:pending:";

export const pendingKey = (kind: PendingKind, pageId: string) => `${PREFIX}${kind}:${pageId}`;

export function stashPending(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ v: value, at: Date.now() }));
  } catch {
    /* storage full or blocked: the async save is still attempted */
  }
}

export function clearPending(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Applies stashed edits; returns the ids of the pages that changed. */
export async function recoverPendingEdits(): Promise<string[]> {
  let keys: string[];
  try {
    keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
  } catch {
    return [];
  }
  const changed = new Set<string>();
  // Title before content before database, so a page gets its title even if a later step fails.
  const order: PendingKind[] = ["title", "content", "database"];
  keys.sort((a, b) => order.indexOf(a.slice(PREFIX.length).split(":")[0] as PendingKind) - order.indexOf(b.slice(PREFIX.length).split(":")[0] as PendingKind));
  // Each page as it was before recovery: restoring its title must not make its content look newer.
  const before = new Map<string, Awaited<ReturnType<typeof getPage>>>();
  for (const key of keys) {
    const [kind, pageId] = key.slice(PREFIX.length).split(":") as [PendingKind, string];
    try {
      const stash = JSON.parse(localStorage.getItem(key) ?? "null") as { v: unknown; at: number } | null;
      if (pageId && !before.has(pageId)) before.set(pageId, await getPage(pageId));
      const page = before.get(pageId);
      // Only if the page still exists and nothing newer was saved since (another tab, a sync).
      if (stash && page && !page.deletedAt && page.updatedAt <= stash.at) {
        if (kind === "title" && typeof stash.v === "string") await savePageTitle(pageId, stash.v);
        else if (kind === "content") await savePageContent(pageId, stash.v);
        else if (kind === "database" && stash.v && typeof stash.v === "object") await saveDatabase(pageId, stash.v as DatabaseData);
        changed.add(pageId);
      }
    } catch (err) {
      console.error("[autosave] recovering an unsaved edit failed", err);
    }
    clearPending(key);
  }
  return [...changed];
}
