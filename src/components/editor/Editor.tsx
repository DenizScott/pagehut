"use client";

import type { Editor as TiptapEditor } from "@tiptap/core";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { GripVertical } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { schemaExtensions } from "@/lib/editor/extensions";
import { COMMENT_FOUND_EVENT, COMMENT_OPEN_EVENT, CommentHighlights, type CommentAnchor } from "@/lib/editor/comment-highlights";
import { anchorFor } from "@/lib/comments/anchor";
import type { Anchor } from "@/lib/comments/types";
import { useDebouncedSaver } from "@/lib/hooks/useDebouncedSaver";
import { ASSET_WARN_BYTES, type PageRecord } from "@/lib/model/schemas";
import { AssetTooLargeError, createPage, listPages, putAsset, savePageContent } from "@/lib/storage/local-repo";
import { ancestorsOf } from "@/lib/tree";
import { useStatus } from "@/lib/stores/status";
import { BubbleToolbar } from "./BubbleToolbar";
import { AssetImage } from "./ImageView";
import { PageLinkCommand } from "./page-link-command";
import type { PageLinkItem } from "./PageLinkMenu";
import { PageLinkWithView } from "./PageLinkView";
import { SlashCommand } from "./slash-command";
import { filterSlash, searchKey, slashItems, type SlashEntry } from "./slash-items";

interface EditorProps {
  page: PageRecord;
  /** Receives a function that focuses the start of the document. */
  onReady?: (focus: () => void) => void;
  /** Called with true/false whenever the document becomes empty or non-empty. */
  onEmptyChange?: (empty: boolean) => void;
  /** Inline comments: highlights for open threads, and the toolbar's Comment button. */
  comments?: {
    anchors: CommentAnchor[];
    active: string | null;
    onOpen: (threadId: string) => void;
    onResolved: (found: string[]) => void;
    onNew: (anchor: Anchor) => void;
  };
}

const PICK_IMAGE_EVENT = "lk:pick-image";

/** Pages matching the text after [[, best matches first, plus a "create" entry for new titles. */
async function pageLinkItems(workspaceId: string, currentId: string, query: string, locale: string): Promise<PageLinkItem[]> {
  const pages = await listPages(workspaceId);
  const q = searchKey(query.trim(), locale);
  const matches = pages
    .filter((p) => p.id !== currentId && (!q || searchKey(p.title, locale).includes(q)))
    .sort((a, b) => Number(!searchKey(a.title, locale).startsWith(q)) - Number(!searchKey(b.title, locale).startsWith(q)))
    .slice(0, 8)
    .map<PageLinkItem>((p) => ({
      kind: "page",
      id: p.id,
      title: p.title,
      icon: p.icon,
      path: ancestorsOf(pages, p.id).map((a) => a.title).join(" / ") || undefined,
    }));
  const exact = pages.some((p) => searchKey(p.title, locale) === q);
  return query.trim() && !exact ? [...matches, { kind: "create", title: query.trim() }] : matches;
}
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

export function Editor({ page, onReady, onEmptyChange, comments }: EditorProps) {
  const t = useTranslations("editor");
  const ts = useTranslations("slash");
  const locale = useLocale();
  const toast = useStatus((s) => s.toast);
  const noteUserEdit = useStatus((s) => s.noteUserEdit);
  const editorRef = useRef<TiptapEditor | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const saver = useDebouncedSaver((doc: unknown) => savePageContent(page.id, doc));
  const wrapper = useRef<HTMLDivElement>(null);
  const commentsRef = useRef(comments);

  // The slash menu asks for an image via a DOM event, so extensions never hold React refs.
  useEffect(() => {
    const el = wrapper.current;
    const open = () => fileInput.current?.click();
    // Comment highlights report clicks and which anchors were found the same way.
    const onOpen = (e: Event) => commentsRef.current?.onOpen((e as CustomEvent<string>).detail);
    const onFound = (e: Event) => commentsRef.current?.onResolved((e as CustomEvent<string[]>).detail);
    el?.addEventListener(PICK_IMAGE_EVENT, open);
    el?.addEventListener(COMMENT_OPEN_EVENT, onOpen);
    el?.addEventListener(COMMENT_FOUND_EVENT, onFound);
    return () => {
      el?.removeEventListener(PICK_IMAGE_EVENT, open);
      el?.removeEventListener(COMMENT_OPEN_EVENT, onOpen);
      el?.removeEventListener(COMMENT_FOUND_EVENT, onFound);
    };
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
  const onEmptyRef = useRef(onEmptyChange);
  useEffect(() => {
    uploadRef.current = uploadImage;
    onEmptyRef.current = onEmptyChange;
    commentsRef.current = comments;
  });

  const extensions = useMemo(
    () => [
      ...schemaExtensions({
        taskCheckbox: (node) => t("a11y.taskCheckbox", { text: node.textContent || t("a11y.emptyTask") }),
        toggle: (isOpen) => (isOpen ? t("a11y.collapse") : t("a11y.expand")),
      }).map((ext) => (ext.name === "image" ? AssetImage : ext.name === "pageLink" ? PageLinkWithView : ext)),
      CommentHighlights,
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
      PageLinkCommand.configure({
        getItems: (query) => pageLinkItems(page.workspaceId, page.id, query, locale),
        createPage: async (title) => (await createPage(page.workspaceId, { title })).id,
        labels: {
          menu: t("pageLink.menu"),
          noResults: t("pageLink.noResults"),
          create: (title) => t("pageLink.create", { title }),
        },
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
        "aria-label": t("contentLabel"),
        spellcheck: "true",
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
    onCreate: ({ editor: e }) => onEmptyRef.current?.(e.isEmpty),
    onUpdate: ({ editor: e }) => {
      saver.schedule(e.getJSON());
      onEmptyRef.current?.(e.isEmpty);
    },
  });

  // Keep comment highlights in step with the threads (anchors are found again on every change).
  const anchors = comments?.anchors;
  const active = comments?.active ?? null;
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.commands.setCommentAnchors(anchors ?? [], active);
  }, [editor, anchors, active]);

  function newComment() {
    const e = editorRef.current;
    if (!e) return;
    const { from, to } = e.state.selection;
    const anchor = anchorFor(e.state.doc, from, to);
    if (anchor) commentsRef.current?.onNew(anchor);
  }

  useEffect(() => {
    editorRef.current = editor;
    // view.focus() is synchronous; commands.focus() alone waits for an animation frame.
    if (editor)
      onReady?.(() => {
        editor.commands.setTextSelection(1);
        editor.view.focus();
      });
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
          <BubbleToolbar editor={editor} onComment={comments ? newComment : undefined} />
        </>
      )}
      {/* Real input only (not load-time normalization) marks the page as being edited. */}
      <EditorContent
        editor={editor}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.altKey && e.code === "KeyM" && comments) {
            e.preventDefault();
            newComment();
            return;
          }
          noteUserEdit();
        }} onInput={noteUserEdit} onPaste={noteUserEdit} onDrop={noteUserEdit} />
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
