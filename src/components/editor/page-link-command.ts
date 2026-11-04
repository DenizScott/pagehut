import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { PageLinkMenu, type PageLinkItem, type PageLinkMenuProps } from "./PageLinkMenu";
import { popupRenderer } from "./suggestion-popup";

export interface PageLinkCommandOptions {
  getItems: (query: string) => Promise<PageLinkItem[]>;
  /** Creates a page with the given title and resolves to its id. */
  createPage: (title: string) => Promise<string>;
  labels: PageLinkMenuProps["labels"];
}

export const pageLinkPluginKey = new PluginKey("pageLinkCommand");

function insertLink(editor: Editor, id: string, title: string) {
  editor.chain().focus().insertContent([{ type: "pageLink", attrs: { id, title } }, { type: "text", text: " " }]).run();
}

/** `[[` opens a page picker; choosing a page inserts a pageLink node. */
export const PageLinkCommand = Extension.create<PageLinkCommandOptions>({
  name: "pageLinkCommand",

  addOptions() {
    return {
      getItems: async () => [],
      createPage: async () => "",
      labels: { menu: "", noResults: "", create: () => "" },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      Suggestion<PageLinkItem, PageLinkItem>({
        editor: this.editor,
        pluginKey: pageLinkPluginKey,
        char: "[[",
        allowSpaces: true,
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => options.getItems(query),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: PageLinkItem }) => {
          // Also swallow a closing "]]" if the user typed one.
          const after = editor.state.doc.textBetween(range.to, Math.min(range.to + 2, editor.state.doc.content.size), "");
          const to = after === "]]" ? range.to + 2 : range.to;
          editor.chain().focus().deleteRange({ from: range.from, to }).run();
          if (props.kind === "page") insertLink(editor, props.id, props.title);
          else void options.createPage(props.title).then((id) => insertLink(editor, id, props.title));
        },
        render: popupRenderer<PageLinkItem, PageLinkMenuProps>(PageLinkMenu, (props) => ({
          items: props.items,
          command: props.command,
          labels: options.labels,
        })),
      }),
    ];
  },
});
