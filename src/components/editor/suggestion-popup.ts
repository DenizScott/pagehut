import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionKeyDownProps, SuggestionOptions, SuggestionProps } from "@tiptap/suggestion";
import type { ComponentType, Ref } from "react";

export interface PopupHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/**
 * Renders a React list for a Tiptap suggestion (slash menu, [[page links]]) in a fixed-position
 * popup placed with floating-ui. Escape closes it.
 */
export function popupRenderer<Item, P extends object>(
  Component: ComponentType<P & { ref?: Ref<PopupHandle> }>,
  toProps: (props: SuggestionProps<Item, Item>) => P,
): SuggestionOptions<Item, Item>["render"] {
  return () => {
    let renderer: ReactRenderer<PopupHandle, P> | null = null;

    const place = (props: SuggestionProps<Item, Item>) => {
      const rect = props.clientRect?.();
      const el = renderer?.element as HTMLElement | undefined;
      if (!rect || !el) return;
      void computePosition({ getBoundingClientRect: () => rect }, el, {
        placement: "bottom-start",
        strategy: "fixed",
        middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
      }).then(({ x, y }) => Object.assign(el.style, { left: `${x}px`, top: `${y}px` }));
    };

    return {
      onStart: (props) => {
        renderer = new ReactRenderer(Component as ComponentType<P>, { props: toProps(props), editor: props.editor });
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
  };
}
