"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, FileDown, History, LayoutTemplate, Menu as MenuIcon, MessageSquare, MoreHorizontal, Printer, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Anchor } from "@/lib/comments/types";
import { getThreads } from "@/lib/storage/comments";
import { githubApi, useGitHub } from "@/lib/github/session";
import { listCollaborators } from "@/lib/github/repo";
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
import { cn } from "@/lib/utils";

// The editor (Tiptap/ProseMirror), databases and comments load in parallel with the page data,
// so the title paints first. The placeholder keeps the layout from jumping.
const editorFallback = () => <div className="min-h-[50vh]" aria-hidden="true" />;
const Editor = dynamic(() => import("@/components/editor/Editor").then((m) => m.Editor), { ssr: false, loading: editorFallback });
const DatabaseView = dynamic(() => import("@/components/database/DatabaseView").then((m) => m.DatabaseView), { ssr: false, loading: editorFallback });
const CommentsPanel = dynamic(() => import("@/components/comments/CommentsPanel").then((m) => m.CommentsPanel), { ssr: false });

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
  const isDatabase = page.kind === "database";
  const [isEmpty, setIsEmpty] = useState(!isDatabase && !page.markdown.trim());
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const focusEditor = useRef<(() => void) | null>(null);
  const titleSaver = useDebouncedSaver((value: string) => savePageTitle(page.id, value));
  const pages = useLiveQuery(() => listPages(page.workspaceId), [page.workspaceId]);
  const ancestors = pages ? ancestorsOf(pages, page.id) : [];
  const workspace = useWorkspace((s) => s.workspace);
  const repo = workspace?.mode === "github" ? workspace.repo : undefined;
  const [historyOpen, setHistoryOpen] = useState(false);
  const setActivePage = useStatus((s) => s.setActivePage);

  // ---- comments ----
  const tc = useTranslations("common.comments");
  // A thread opened from the mentions inbox shows right away.
  const [initialThread] = useState(() => {
    const target = useUI.getState().threadToOpen;
    return target?.pageId === page.id ? target.threadId : null;
  });
  const [commentsOpen, setCommentsOpen] = useState(!!initialThread);
  const [activeThread, setActiveThread] = useState<string | null>(initialThread);
  useEffect(() => {
    if (initialThread) useUI.getState().focusThread(null);
    // Also when this page is already open (the page doesn't remount).
    return useUI.subscribe((s) => {
      if (s.threadToOpen?.pageId !== page.id) return;
      setCommentsOpen(true);
      setActiveThread(s.threadToOpen.threadId);
      s.focusThread(null);
    });
  }, [initialThread, page.id]);
  const [draft, setDraft] = useState<Anchor | null>(null);
  const [found, setFound] = useState<string[] | null>(null);
  const threads = useLiveQuery(() => getThreads(page.id), [page.id]);
  const me = useGitHub((s) => s.user?.login) ?? "";
  const signedIn = useGitHub((s) => s.status === "signedIn");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  useEffect(() => {
    if (!repo || !signedIn || !commentsOpen) return;
    let cancelled = false;
    void listCollaborators(githubApi(), repo).then((list) => !cancelled && setCollaborators(list));
    return () => {
      cancelled = true;
    };
  }, [repo, signedIn, commentsOpen]);
  const people = useMemo(
    () => [...new Set([...collaborators, ...(threads ?? []).flatMap((th) => th.comments.map((c) => c.author))])].filter((l) => l && l !== me).sort(),
    [collaborators, threads, me],
  );
  const openThreads = (threads ?? []).filter((th) => !th.resolved);
  const anchors = useMemo(
    () => (threads ?? []).filter((th) => th.anchor && !th.resolved).map((th) => ({ id: th.id, anchor: th.anchor! })),
    [threads],
  );
  const detached = useMemo(() => (found ? new Set(anchors.map((a) => a.id).filter((id) => !found.includes(id))) : null), [anchors, found]);

  // Background sync leaves the page being typed in alone (see canTouchPage).
  useEffect(() => {
    setActivePage(page.id);
    return () => setActivePage(null);
  }, [page.id, setActivePage]);

  // A brand-new page starts with the cursor in the title.
  useEffect(() => {
    if (!page.title && (isDatabase || !page.markdown.trim())) titleRef.current?.focus();
  }, [page.title, page.markdown, isDatabase]);

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
        <button
          type="button"
          onClick={() => setCommentsOpen((o) => !o)}
          aria-pressed={commentsOpen}
          aria-label={(openThreads.length ? tc("toggle", { count: openThreads.length }) : tc("title"))}
          title={(openThreads.length ? tc("toggle", { count: openThreads.length }) : tc("title"))}
          className={cn("flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-fg-muted hover:bg-surface-hover hover:text-fg", commentsOpen && "bg-surface-active text-fg")}
        >
          <MessageSquare className="size-4" aria-hidden="true" />
          {openThreads.length > 0 && <span className="tabular-nums">{openThreads.length}</span>}
        </button>
        {repo && page.base && <LastEditor repo={repo} pageId={page.id} headSha={workspace?.headSha} />}
        <SaveStatus />
        <SyncButton />
        <Menu>
          <MenuTrigger className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label={t("shell.pageActions")}>
            <MoreHorizontal className="size-4" />
          </MenuTrigger>
          <MenuContent align="end">
            {!isDatabase && (
              <MenuItem onSelect={() => openDialog("templates", { targetPageId: page.id })}>
                <LayoutTemplate /> {t("templates.applyHere")}
              </MenuItem>
            )}
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

      <div className="flex min-h-0 flex-1">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <article className={cn("mx-auto w-full px-6 pt-10 md:pt-14", isDatabase ? "max-w-[1040px] pb-16 md:px-10" : "max-w-3xl md:px-16")}>
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
            className="lk-page-title mb-4 w-full resize-none overflow-hidden bg-transparent text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
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
          {isDatabase ? (
            <DatabaseView page={page} />
          ) : (
            <Editor
              page={page}
              onReady={(focus) => (focusEditor.current = focus)}
              onEmptyChange={setIsEmpty}
              comments={{
                anchors,
                active: activeThread,
                onOpen: (id) => {
                  setCommentsOpen(true);
                  setActiveThread(id);
                },
                onResolved: setFound,
                onNew: (anchor) => {
                  setDraft(anchor);
                  setCommentsOpen(true);
                },
              }}
            />
          )}
          <Backlinks pageId={page.id} workspaceId={page.workspaceId} />
        </article>
      </div>
      {commentsOpen && (
        <CommentsPanel
          pageId={page.id}
          workspaceId={page.workspaceId}
          threads={threads ?? []}
          me={me}
          people={people}
          active={activeThread}
          onActivate={setActiveThread}
          draft={draft}
          onDraftDone={() => setDraft(null)}
          detached={isDatabase ? null : detached}
          onClose={() => {
            setCommentsOpen(false);
            setActiveThread(null);
          }}
        />
      )}
      </div>
    </>
  );
}
