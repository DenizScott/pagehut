import MiniSearch from "minisearch";
import { searchKey } from "@/lib/text";

/**
 * Workspace full-text search (titles + page text), entirely in the browser.
 * Case-, accent- and Turkish-ı-insensitive; prefix and light fuzzy matching.
 */

export interface SearchablePage {
  id: string;
  title: string;
  markdown: string;
  updatedAt: number;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string | null;
  score: number;
}

/** Markdown → plain text for indexing and snippets. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[\[page:[0-9A-Z]{26}\|?([^\]]*)\]\]/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^:{3,}\S*.*$/gm, (line) => line.replace(/^:{3,}(callout \w+|toggle)?\s*/, ""))
    .replace(/^\s*(?:#{1,6}|>|[-*+]|\d+\.)\s+(\[[ xX]\]\s+)?/gm, "")
    .replace(/^\|?\s*-{3,}.*$/gm, "")
    .replace(/[*_~`|+]{1,3}/g, "")
    .replace(/\\([\\`*_[\]{}()#+\-.!|])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function createSearch(pages: SearchablePage[], locale: string) {
  const mini = new MiniSearch<{ id: string; title: string; text: string }>({
    fields: ["title", "text"],
    storeFields: ["title", "text"],
    processTerm: (term) => searchKey(term, locale) || null,
    searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: (term) => (term.length > 4 ? 0.2 : 0), combineWith: "AND" },
  });
  mini.addAll(pages.map((p) => ({ id: p.id, title: p.title, text: plainText(p.markdown) })));

  return (query: string, limit = 20): SearchHit[] => {
    const q = query.trim();
    if (!q) return [];
    return mini.search(q).slice(0, limit).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      snippet: snippet(r.text as string, q, locale),
      score: r.score,
    }));
  };
}

/** ~140 characters of text around the first matching word, or null if the title matched only. */
export function snippet(text: string, query: string, locale: string): string | null {
  const words = searchKey(query, locale).split(/\s+/).filter(Boolean);
  const hay = searchKey(text, locale);
  let at = -1;
  for (const w of words) {
    const i = hay.indexOf(w);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return null;
  // searchKey keeps string length for Latin text (it strips combining marks after NFD),
  // so the index maps closely enough to the original for a context window.
  const start = Math.max(0, at - 50);
  const end = Math.min(text.length, at + 90);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}
