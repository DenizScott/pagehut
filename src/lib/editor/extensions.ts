import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Image from "@tiptap/extension-image";
import { Callout } from "./callout";

/**
 * Document schema shared by the editor UI and the Markdown (de)serializer.
 * Every node/mark here MUST have a Markdown mapping in src/lib/markdown and a round-trip test.
 * UI-only extensions (placeholder, slash menu, drag handle, node views) are added in the editor component.
 */
export function schemaExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      // Undo history and cursors are UI concerns, but harmless in a headless schema.
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Details.configure({ persist: false, HTMLAttributes: { class: "lk-details" } }),
    DetailsSummary,
    DetailsContent,
    Image.configure({ inline: false, allowBase64: false }),
    Callout,
  ];
}
