import type { docToMarkdown as DocToMarkdown } from "./serialize";
import type { markdownToDoc as MarkdownToDoc } from "./parse";

/**
 * Lazy access to the Markdown <-> document converters.
 *
 * The converters bring the whole editor schema (Tiptap + ProseMirror), so loading them eagerly
 * puts the editor core in the first bundle and delays the first paint. Code that converts calls
 * `await loadMarkdown()` at its entry point (before any IndexedDB transaction, where an `await`
 * on a dynamic import would end the transaction) and then uses the synchronous `markdown()`.
 */

export interface MarkdownConverters {
  markdownToDoc: typeof MarkdownToDoc;
  docToMarkdown: typeof DocToMarkdown;
}

let loaded: MarkdownConverters | null = null;
let pending: Promise<MarkdownConverters> | null = null;

export function loadMarkdown(): Promise<MarkdownConverters> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= Promise.all([import("./parse"), import("./serialize")])
    .then(([parse, serialize]) => {
      loaded = { markdownToDoc: parse.markdownToDoc, docToMarkdown: serialize.docToMarkdown };
      return loaded;
    })
    .catch((err: unknown) => {
      pending = null; // a failed chunk load (offline) can be retried
      throw err;
    });
  return pending;
}

/** The converters, once `loadMarkdown()` has resolved. Throws otherwise: a missing await is a bug. */
export function markdown(): MarkdownConverters {
  if (!loaded) throw new Error("Markdown converters are not loaded yet: await loadMarkdown() at the entry point");
  return loaded;
}
