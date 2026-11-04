import { Node, mergeAttributes } from "@tiptap/core";

/**
 * Inline link to another page. Stored by id so renames never break it; `title` is a cached hint
 * for readers of the raw Markdown on GitHub. Markdown: `[[page:<ULID>|Title]]`.
 */
export const PageLink = Node.create({
  name: "pageLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null, parseHTML: (el) => el.getAttribute("data-page-id"), renderHTML: (a) => ({ "data-page-id": a.id }) },
      title: { default: "", parseHTML: (el) => el.textContent ?? "", renderHTML: () => ({}) },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-page-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-page-link": "", href: `#page-${node.attrs.id}` }), node.attrs.title || "…"];
  },

  renderText({ node }) {
    return node.attrs.title as string;
  },
});

/** Characters that would break the `[[page:id|Title]]` syntax are dropped from the title hint. */
export function pageLinkTitle(title: string): string {
  return title.replace(/[\]|\n]/g, " ").replace(/\s+/g, " ").trim();
}
