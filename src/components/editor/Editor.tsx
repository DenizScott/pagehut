"use client";

import type { Editor as TiptapEditor } from "@tiptap/core";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { GripVertical } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { schemaExtensions } from "@/lib/editor/extensions";
import { useDebouncedSaver } from "@/lib/hooks/useDebouncedSaver";
import { ASSET_WARN_BYTES, type PageRecord } from "@/lib/model/schemas";
import { AssetTooLargeError, putAsset, savePageContent } from "@/lib/storage/local-repo";
import { useStatus } from "@/lib/stores/status";
import { BubbleToolbar } from "./BubbleToolbar";
import { AssetImage } from "./ImageView";
import { SlashCommand } from "./slash-command";
import { filterSlash, searchKey, slashItems, type SlashEntry } from "./slash-items";

interface EditorProps {
  page: PageRecord;
  /** Receives a function that focuses the start of the document. */
  onReady?: (focus: () => void) => void;
}

const PICK_IMAGE_EVENT = "lk:pick-image";
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export function Editor({ page, onReady }: EditorProps) {
  const t = useTranslations("editor");
  const ts = useTranslations("slash");
  const locale = useLocale();
  const toast = useStatus((s) => s.toast);
  const editorRef = useRef<TiptapEditor | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const saver = useDebouncedSaver((doc: unknown) => savePageContent(page.id, doc));
  const wrapper = useRef<HTMLDivElement>(null);

  // The slash menu asks for an image via a DOM event, so extensions never hold React refs.
  useEffect(() => {
    const el = wrapper.current;
    const open = () => fileInput.current?.click();
    el?.addEventListener(PICK_IMAGE_EVENT, open);
    return () => el?.removeEventListener(PICK_IMAGE_EVENT, open);
  }, []);

  const slashEntries = useMemo<SlashEntry[]>(
    () =>
      slashItems.map((item) => {
        const title = ts(`items.${item.id}.title`);
        const description = ts(`items.${item.id}.description`);
        const keywords = ts(`items.${item.id}.keywords`);
        return { ...item, title, description, haystack: searchKey([title, keywords, ...item.aliases].join(" "), locale) };
      }),
    [ts, locale],
  );

  async function uploadImage(file: File) {
    const editor = editorRef.current;
    if (!editor || !file.type.startsWith("image/")) return;
    if (file.size > ASSET_WARN_BYTES) toast(t("image.large", { size: mb(file.size) }), "warning");
    try {
      const asset = await putAsset(page.workspaceId, file);
      editor.chain().focus().setImage({ src: asset.path, alt: file.name.replace(/\.[^.]+$/, "") }).run();
    } catch (err) {
      if (err instanceof AssetTooLargeError) toast(t("image.tooLarge", { size: mb(err.size) }), "error");
      else {
        console.error(err);
        toast(t("image.failed"), "error");
      }
    }
  }
  const uploadRef = useRef(uploadImage);
  useEffect(() => {
    uploadRef.current = uploadImage;
  });

  const extensions = useMemo(
    () => [
      ...schemaExtensions().map((ext) => (ext.name === "image" ? AssetImage : ext)),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? t("headingPlaceholder", { level: node.attrs.level as number }) : t("placeholder"),
      }),
      SlashCommand.configure({
        getItems: (query) => filterSlash(slashEntries, query, locale),
        labels: {
          menu: ts("label"),
          noResults: ts("noResults"),
          groups: { basic: ts("groups.basic"), structure: ts("groups.structure"), media: ts("groups.media") },
        },
        context: { pickImage: (e) => e.view.dom.dispatchEvent(new CustomEvent(PICK_IMAGE_EVENT, { bubbles: true })) },
      }),
    ],
    // Extensions are created once per mounted page; labels follow the locale via remount on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: page.doc as object,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "lk-editor-content",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": page.title || "Document",
        spellcheck: "true",
        lang: locale,
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        files.forEach((f) => void uploadRef.current(f));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((f) => void uploadRef.current(f));
        return true;
      },
    },
    onUpdate: ({ editor: e }) => saver.schedule(e.getJSON()),
  });

  useEffect(() => {
    editorRef.current = editor;
    if (editor) onReady?.(() => editor.commands.focus("start"));
  }, [editor, onReady]);

  return (
    <div ref={wrapper} className="lk-editor">
      {editor && (
        <>
          <DragHandle editor={editor}>
            <div className="lk-drag-handle lk-no-print" aria-label={t("dragHandle")} title={t("dragHandle")}>
              <GripVertical className="size-4" aria-hidden="true" />
            </div>
          </DragHandle>
          <BubbleToolbar editor={editor} />
        </>
      )}
      <EditorContent editor={editor} />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImage(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
