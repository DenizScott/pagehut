import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { SlashMenu, type SlashMenuProps } from "./SlashMenu";
import type { SlashContext, SlashEntry } from "./slash-items";
import { popupRenderer } from "./suggestion-popup";

export interface SlashCommandOptions {
  getItems: (query: string) => SlashEntry[];
  labels: SlashMenuProps["labels"];
  context: SlashContext;
}

export const slashPluginKey = new PluginKey("slashCommand");

/** `/` opens the block menu anywhere except inside code blocks. */
export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      getItems: () => [],
      labels: { menu: "", noResults: "", groups: { basic: "", structure: "", media: "" } },
      context: { pickImage: () => {} },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      Suggestion<SlashEntry, SlashEntry>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: "/",
        allowSpaces: true,
        allow: ({ state, range }) => !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ query }) => options.getItems(query),
        command: ({ editor, range, props }) => props.run(editor, range, options.context),
        render: popupRenderer<SlashEntry, SlashMenuProps>(SlashMenu, (props) => ({
          items: props.items,
          command: props.command,
          labels: options.labels,
        })),
      }),
    ];
  },
});
