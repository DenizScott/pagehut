import { Node, mergeAttributes } from "@tiptap/core";

export const calloutVariants = ["info", "warning", "danger", "success", "idea"] as const;
export type CalloutVariant = (typeof calloutVariants)[number];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (variant?: CalloutVariant) => ReturnType;
    };
  }
}

/** Highlighted note block. Markdown: `:::callout <variant>` … `:::` */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "info" as CalloutVariant,
        parseHTML: (el) => {
          const v = el.getAttribute("data-callout");
          return (calloutVariants as readonly string[]).includes(v ?? "") ? v : "info";
        },
        renderHTML: (attrs) => ({ "data-callout": attrs.variant }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { role: "note" }), ["div", 0]];
  },

  addCommands() {
    return {
      setCallout:
        (variant = "info") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant }),
    };
  },
});
