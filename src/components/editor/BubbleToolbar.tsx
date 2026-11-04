"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Code, Italic, Link2, Strikethrough, Underline } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function BubbleToolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("editor.toolbar");
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
    }),
  });

  const buttons = [
    { key: "bold", Icon: Bold, run: () => editor.chain().focus().toggleBold().run(), kbd: "Ctrl+B" },
    { key: "italic", Icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), kbd: "Ctrl+I" },
    { key: "underline", Icon: Underline, run: () => editor.chain().focus().toggleUnderline().run(), kbd: "Ctrl+U" },
    { key: "strike", Icon: Strikethrough, run: () => editor.chain().focus().toggleStrike().run(), kbd: "Ctrl+Shift+S" },
    { key: "code", Icon: Code, run: () => editor.chain().focus().toggleCode().run(), kbd: "Ctrl+E" },
    {
      key: "link",
      Icon: Link2,
      kbd: "",
      run: () => {
        const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
        const href = window.prompt(t("linkPrompt"), prev);
        if (href === null) return;
        if (href.trim() === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
        else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
      },
    },
  ] as const;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: e, state: s }) => !s.selection.empty && !e.isActive("codeBlock") && !e.isActive("image")}
      className="lk-no-print"
    >
      <div
        role="toolbar"
        aria-label={t("label")}
        className="flex items-center gap-0.5 rounded-lg border border-hairline bg-surface-glass p-1 shadow-float backdrop-blur-xl"
      >
        {buttons.map(({ key, Icon, run, kbd }) => (
          <button
            key={key}
            type="button"
            onClick={run}
            aria-pressed={state[key]}
            aria-label={t(key)}
            title={kbd ? `${t(key)} (${kbd})` : t(key)}
            className={cn(
              "grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg",
              state[key] && "bg-accent-soft text-accent-text",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        ))}
      </div>
    </BubbleMenu>
  );
}
