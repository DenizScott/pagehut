"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, FileDown, History, LayoutTemplate, Menu as MenuIcon, MoreHorizontal, Printer, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import { Editor } from "@/components/editor/Editor";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Link, useRouter } from "@/i18n/navigation";
import { useDebouncedSaver } from "@/lib/hooks/useDebouncedSaver";
import type { PageRecord } from "@/lib/model/schemas";
import { getPage, listPages, savePageTitle, trashPage } from "@/lib/storage/local-repo";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";
import { exportPageMarkdown } from "@/lib/transfer/export";
import { ancestorsOf } from "@/lib/tree";
import { Backlinks } from "./Backlinks";
import { PillarsStrip } from "./PillarsStrip";
import { SaveStatus } from "./SaveStatus";
import { SyncButton } from "./SyncButton";
import { ConflictBanner } from "./ConflictBanner";
import { LastEditor, PageHistoryDialog } from "./PageHistory";
import { useStatus } from "@/lib/stores/status";

type Load = { state: "loading" } | { state: "missing" } | { state: "ready"; page: PageRecord };

export function PageView() {
  const { pageId } = useParams<{ pageId: string }>();
  const t = useTranslations("common");
  const contentVersion = useUI((s) => s.contentVersion);
  // `for` records which page id and content version this result belongs to.
  const [load, setLoad] = useState<Load & { for?: string }>({ state: "loading" });
  // Live view of the record, only to notice that the page was moved to trash elsewhere.
  const live = useLiveQuery(() => getPage(pageId), [pageId]);
  const want = `${pageId}:${contentVersion}`;

  useEffect(() => {
    let cancelled = false;
    getPage(pageId).then((page) => {
      if (cancelled) return;
      setLoad({ ...(page && !page.deletedAt ? { state: "ready", page } : { state: "missing" }), for: `${pageId}:${contentVersion}` });
    });
    return () => {
      cancelled = true;
    };
  }, [pageId, contentVersion]);

  // Never show the previous page while the next one loads: typing there would edit the wrong page.
  if (load.state === "loading" || load.for !== want) return null;
  if (load.state === "missing" || live?.deletedAt)
    return (
      <div className="m-auto max-w-sm p-6 text-center">
        <p className="mb-3 text-fg-muted">{t("shell.notFound")}</p>
        <HomeLink label={t("shell.backHome")} />
      </div>
    );
  // key: remount editor state per page (and after a template replaced the content).
  return <PageEditor key={want} page={load.page} />;
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
  const openDialog = useUI((s) => s.open);
  const [title, setTitle] = useState(page.title);
  const [isEmpty, setIsEmpty] = useState(!page.markdown.trim());
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const focusEditor = useRef<(() => void) | null>(null);
  const titleSaver = useDebouncedSaver((value: string) => savePageTitle(page.id, value));
  const pages = useLiveQuery(() => listPages(page.workspaceId), [page.workspaceId]);
  const ancestors = pages ? ancestorsOf(pages, page.id) : [];
  const workspace = useWorkspace((s) => s.workspace);
  const repo = workspace?.mode === "github" ? workspace.repo : undefined;
  const [historyOpen, setHistoryOpen] = useState(false);
  const setActivePage = useStatus((s) => s.setActivePage);

  // Background sync leaves the page being typed in alone (see canTouchPage).
  useEffect(() => {
    setActivePage(page.id);
    return () => setActivePage(null);
  }, [page.id, setActivePage]);

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

  async function onExportMarkdown() {
    await titleSaver.flush();
    const fresh = await getPage(page.id);
    if (fresh) exportPageMarkdown(fresh);
  }

  return (
    <>
      <header className="lk-no-print flex h-11 shrink-0 items-center gap-2 border-b border-hairline px-2 md:px-3">
        <Button size="icon-sm" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label={t("a11y.openSidebar")}>
          <MenuIcon />
        </Button>
        <nav aria-label={t("page.breadcrumbs")} className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1 text-sm text-fg-muted">
            {ancestors.map((a) => (
              <Fragment key={a.id}>
                <li className="hidden min-w-0 shrink sm:block">
                  <Link href={`/p/${a.id}`} className="block truncate rounded px-1 hover:bg-surface-hover hover:text-fg">
                    {a.title || t("shell.untitled")}
                  </Link>
                </li>
                <li aria-hidden="true" className="hidden shrink-0 sm:block">
                  <ChevronRight className="size-3.5 text-fg-subtle rtl:rotate-180" />
                </li>
              </Fragment>
            ))}
            <li className="min-w-0 truncate px-1" aria-current="page">
              {title || t("shell.untitled")}
            </li>
          </ol>
        </nav>
        {repo && page.base && <LastEditor repo={repo} pageId={page.id} headSha={workspace?.headSha} />}
        <SaveStatus />
        <SyncButton />
        <Menu>
          <MenuTrigger className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label={t("shell.pageActions")}>
            <MoreHorizontal className="size-4" />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => openDialog("templates", { targetPageId: page.id })}>
              <LayoutTemplate /> {t("templates.applyHere")}
            </MenuItem>
            {repo && (
              <MenuItem onSelect={() => setHistoryOpen(true)}>
                <History /> {t("history.title")}
              </MenuItem>
            )}
            <MenuSeparator />
            <MenuItem onSelect={() => void onExportMarkdown()}>
              <FileDown /> {t("transfer.exportMarkdown")}
            </MenuItem>
            <MenuItem onSelect={() => setTimeout(() => window.print(), 50)}>
              <Printer /> {t("transfer.exportPdf")}
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={() => void onDelete()} className="text-danger">
              <Trash2 className="!text-danger" /> {t("shell.deletePage")}
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>
      <PillarsStrip />
      <ConflictBanner pageId={page.id} />
      {repo && (
        <PageHistoryDialog
          repo={repo}
          pageId={page.id}
          workspaceId={page.workspaceId}
          headSha={workspace?.headSha}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className="mx-auto w-full max-w-3xl px-6 pt-10 md:px-16 md:pt-14">
          <textarea
            ref={titleRef}
            value={title}
            rows={1}
            aria-label={t("page.titleLabel")}
            placeholder={t("page.titlePlaceholder")}
            onChange={(e) => {
              useStatus.getState().noteUserEdit();
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
          {isEmpty && (
            <button
              type="button"
              onClick={() => openDialog("templates", { targetPageId: page.id })}
              className="lk-no-print mb-3 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-fg-subtle hover:bg-surface-hover hover:text-fg"
            >
              <LayoutTemplate className="size-4" aria-hidden="true" />
              {t("templates.startWith")}
            </button>
          )}
          <Editor
            page={page}
            onReady={(focus) => (focusEditor.current = focus)}
            onEmptyChange={setIsEmpty}
          />
          <Backlinks pageId={page.id} workspaceId={page.workspaceId} />
        </article>
      </div>
    </>
  );
}
