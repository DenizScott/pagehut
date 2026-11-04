"use client";

import { Menu, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Editor } from "@/components/editor/Editor";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useDebouncedSaver } from "@/lib/hooks/useDebouncedSaver";
import type { PageRecord } from "@/lib/model/schemas";
import { getPage, savePageTitle, trashPage } from "@/lib/storage/local-repo";
import { useWorkspace } from "@/lib/stores/workspace";
import { SaveStatus } from "./SaveStatus";

type Load = { state: "loading" } | { state: "missing" } | { state: "ready"; page: PageRecord };

export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const t = useTranslations("common");
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    getPage(pageId).then((page) => {
      if (cancelled) return;
      setLoad(page && !page.deletedAt ? { state: "ready", page } : { state: "missing" });
    });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  if (load.state === "loading") return null;
  if (load.state === "missing")
    return (
      <div className="m-auto max-w-sm p-6 text-center">
        <p className="mb-3 text-fg-muted">{t("shell.notFound")}</p>
        <HomeLink label={t("shell.backHome")} />
      </div>
    );
  // key: remount editor state per page so nothing leaks between pages.
  return <PageEditor key={load.page.id} page={load.page} />;
}

function HomeLink({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button variant="subtle" onClick={() => router.replace("/")}>
      {label}
    </Button>
  );
}

function PageEditor({ page }: { page: PageRecord }) {
  const t = useTranslations("common");
  const router = useRouter();
  const setSidebarOpen = useWorkspace((s) => s.setSidebarOpen);
  const [title, setTitle] = useState(page.title);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const focusEditor = useRef<(() => void) | null>(null);
  const titleSaver = useDebouncedSaver((value: string) => savePageTitle(page.id, value));

  // A brand-new page starts with the cursor in the title.
  useEffect(() => {
    if (!page.title && !page.markdown.trim()) titleRef.current?.focus();
  }, [page.title, page.markdown]);

  // Auto-grow the title textarea.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  async function onDelete() {
    await trashPage(page.id);
    router.replace("/");
  }

  return (
    <>
      <header className="lk-no-print flex h-11 shrink-0 items-center gap-2 border-b border-hairline px-2 md:px-3">
        <Button size="icon-sm" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label={t("a11y.openSidebar")}>
          <Menu />
        </Button>
        <p className="min-w-0 flex-1 truncate text-sm text-fg-muted">{title || t("shell.untitled")}</p>
        <SaveStatus />
        <Button size="icon-sm" onClick={onDelete} aria-label={t("shell.deletePage")} title={t("shell.deletePage")}>
          <Trash2 />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-3xl px-6 pt-10 md:px-16 md:pt-16">
          <textarea
            ref={titleRef}
            value={title}
            rows={1}
            aria-label={t("page.titleLabel")}
            placeholder={t("page.titlePlaceholder")}
            onChange={(e) => {
              const value = e.target.value.replace(/\n/g, " ");
              setTitle(value);
              titleSaver.schedule(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || (e.key === "ArrowDown" && e.currentTarget.selectionStart === title.length)) {
                e.preventDefault();
                focusEditor.current?.();
              }
            }}
            className="mb-4 w-full resize-none overflow-hidden bg-transparent text-4xl leading-tight font-bold tracking-tight text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
          />
          <Editor page={page} onReady={(focus) => (focusEditor.current = focus)} />
        </article>
      </div>
    </>
  );
}
