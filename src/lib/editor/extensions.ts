import type { AnyExtension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Image from "@tiptap/extension-image";
import { Callout } from "./callout";
import { PageLink } from "./page-link";

/** Localized accessibility labels; they change rendering only, never the schema. */
export interface EditorA11yLabels {
  taskCheckbox: (node: PMNode, checked: boolean) => string;
  toggle: (isOpen: boolean) => string;
}

/**
 * Document schema shared by the editor UI and the Markdown (de)serializer.
 * Every node/mark here MUST have a Markdown mapping in src/lib/markdown and a round-trip test.
 * UI-only extensions (placeholder, slash menu, drag handle, node views) are added in the editor component.
 */
export function schemaExtensions(labels?: EditorA11yLabels): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      ...(labels ? { a11y: { checkboxLabel: labels.taskCheckbox } } : {}),
    }),
    TableKit.configure({ table: { resizable: false } }),
    Details.configure({
      persist: false,
      HTMLAttributes: { class: "lk-details" },
      ...(labels
        ? {
            renderToggleButton: ({ element, isOpen }) => {
              element.setAttribute("aria-label", labels.toggle(isOpen));
              element.setAttribute("aria-expanded", String(isOpen));
            },
          }
        : {}),
    }),
    DetailsSummary,
    DetailsContent,
    Image.configure({ inline: false, allowBase64: false }),
    Callout,
    PageLink,
  ];
}
