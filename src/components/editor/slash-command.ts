import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { SlashMenu, type SlashMenuHandle, type SlashMenuProps } from "./SlashMenu";
import type { SlashContext, SlashEntry } from "./slash-items";

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
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          return !$from.parent.type.spec.code;
        },
        items: ({ query }) => options.getItems(query),
        command: ({ editor, range, props }) => props.run(editor, range, options.context),
        render: () => {
          let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;

          const place = (props: SuggestionProps<SlashEntry, SlashEntry>) => {
            const rect = props.clientRect?.();
            const el = renderer?.element as HTMLElement | undefined;
            if (!rect || !el) return;
            void computePosition({ getBoundingClientRect: () => rect }, el, {
              placement: "bottom-start",
              strategy: "fixed",
              middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
            }).then(({ x, y }) => {
              Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
            });
          };

          const toProps = (props: SuggestionProps<SlashEntry, SlashEntry>): SlashMenuProps => ({
            items: props.items,
            command: props.command,
            labels: options.labels,
          });

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashMenu, { props: toProps(props), editor: props.editor });
              const el = renderer.element as HTMLElement;
              Object.assign(el.style, { position: "fixed", zIndex: "50", left: "0px", top: "0px" });
              document.body.appendChild(el);
              place(props);
            },
            onUpdate: (props) => {
              renderer?.updateProps(toProps(props));
              place(props);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                renderer?.element.remove();
                return true;
              }
              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              renderer?.element.remove();
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
