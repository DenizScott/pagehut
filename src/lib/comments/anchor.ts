import type { Node as PMNode } from "@tiptap/pm/model";
import type { Anchor } from "./types";

/**
 * Text-quote anchors over a ProseMirror document. The document is flattened to plain text with
 * "\n" between blocks, keeping a map from text offsets back to document positions.
 */

const CONTEXT = 32;

interface Flat {
  text: string;
  /** pos[i] = document position of text[i] (or -1 for block separators). */
  pos: number[];
}

export function flatten(doc: PMNode): Flat {
  let text = "";
  const pos: number[] = [];
  doc.descendants((node, at) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        text += node.text[i];
        pos.push(at + i);
      }
    } else if (node.isBlock && text.length && !text.endsWith("\n")) {
      text += "\n";
      pos.push(-1);
    }
    return true;
  });
  return { text, pos };
}

/** The anchor for the text between two document positions (null if it has no text). */
export function anchorFor(doc: PMNode, from: number, to: number): Anchor | null {
  const { text, pos } = flatten(doc);
  const start = pos.findIndex((p) => p >= from);
  let end = -1;
  for (let i = pos.length - 1; i >= 0; i--) {
    if (pos[i] >= 0 && pos[i] < to) {
      end = i + 1;
      break;
    }
  }
  if (start < 0 || end <= start) return null;
  const exact = text.slice(start, end).trim();
  if (!exact) return null;
  const s = text.indexOf(exact, start);
  return { exact, prefix: text.slice(Math.max(0, s - CONTEXT), s), suffix: text.slice(s + exact.length, s + exact.length + CONTEXT) };
}

/** Length of the common suffix of a and prefix-side b (how well the context still matches). */
function tailMatch(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function headMatch(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Finds an anchor in the document again: every occurrence of the quote is scored by how much of
 * the surrounding text still matches. Returns document positions, or null if the quote is gone.
 */
export function findAnchor(doc: PMNode, anchor: Anchor, flat: Flat = flatten(doc)): { from: number; to: number } | null {
  const { text, pos } = flat;
  let best: { index: number; score: number } | null = null;
  for (let i = text.indexOf(anchor.exact); i >= 0; i = text.indexOf(anchor.exact, i + 1)) {
    const score = tailMatch(text.slice(Math.max(0, i - anchor.prefix.length), i), anchor.prefix) + headMatch(text.slice(i + anchor.exact.length), anchor.suffix);
    if (!best || score > best.score) best = { index: i, score };
  }
  if (!best) return null;
  const startPos = pos[best.index];
  let last = best.index + anchor.exact.length - 1;
  while (last > best.index && pos[last] < 0) last--;
  if (startPos < 0 || pos[last] < 0) return null;
  return { from: startPos, to: pos[last] + 1 };
}
