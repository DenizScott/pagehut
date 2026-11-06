import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findAnchor, flatten } from "@/lib/comments/anchor";
import type { Anchor } from "@/lib/comments/types";

/**
 * Highlights the text that open comment threads are anchored to. Anchors are found again on every
 * change (see lib/comments/anchor.ts), so highlights follow edits, merges and syncs. Decorations
 * only: comments never change the document or its Markdown.
 */

export interface CommentAnchor {
  id: string;
  anchor: Anchor;
}

interface PluginState {
  anchors: CommentAnchor[];
  active: string | null;
  decorations: DecorationSet;
  found: string[];
}

export const commentHighlightsKey = new PluginKey<PluginState>("commentHighlights");

function build(state: EditorState, anchors: CommentAnchor[], active: string | null): Pick<PluginState, "decorations" | "found"> {
  if (!anchors.length) return { decorations: DecorationSet.empty, found: [] };
  const flat = flatten(state.doc);
  const decos: Decoration[] = [];
  const found: string[] = [];
  for (const a of anchors) {
    const range = findAnchor(state.doc, a.anchor, flat);
    if (!range) continue;
    found.push(a.id);
    decos.push(Decoration.inline(range.from, range.to, { class: a.id === active ? "lk-comment lk-comment-active" : "lk-comment", "data-thread": a.id }));
  }
  return { decorations: DecorationSet.create(state.doc, decos), found };
}

/** DOM events on the editor element: a highlight was clicked (detail: thread id), and which threads were found in the text (detail: ids; the others are detached). */
export const COMMENT_OPEN_EVENT = "lk:comment-open";
export const COMMENT_FOUND_EVENT = "lk:comment-found";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentHighlights: {
      setCommentAnchors: (anchors: CommentAnchor[], active: string | null) => ReturnType;
    };
  }
}

export const CommentHighlights = Extension.create({
  name: "commentHighlights",

  addCommands() {
    return {
      setCommentAnchors:
        (anchors, active) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(commentHighlightsKey, { anchors, active }).setMeta("addToHistory", false);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    let lastFound = "";
    return [
      new Plugin<PluginState>({
        key: commentHighlightsKey,
        state: {
          init: () => ({ anchors: [], active: null, decorations: DecorationSet.empty, found: [] }),
          apply(tr, prev, _old, state) {
            const meta = tr.getMeta(commentHighlightsKey) as { anchors: CommentAnchor[]; active: string | null } | undefined;
            if (meta) return { ...meta, ...build(state, meta.anchors, meta.active) };
            if (tr.docChanged) return { ...prev, ...build(state, prev.anchors, prev.active) };
            return prev;
          },
        },
        props: {
          decorations: (state) => commentHighlightsKey.getState(state)?.decorations,
          handleClick(view, _pos, event) {
            const el = (event.target as HTMLElement | null)?.closest?.("[data-thread]");
            const id = el?.getAttribute("data-thread");
            if (id) view.dom.dispatchEvent(new CustomEvent(COMMENT_OPEN_EVENT, { detail: id, bubbles: true }));
            return false;
          },
        },
        view: () => ({
          update(view) {
            const found = commentHighlightsKey.getState(view.state)?.found ?? [];
            const key = found.join(",");
            if (key !== lastFound) {
              lastFound = key;
              view.dom.dispatchEvent(new CustomEvent(COMMENT_FOUND_EVENT, { detail: found, bubbles: true }));
            }
          },
        }),
      }),
    ];
  },
});
