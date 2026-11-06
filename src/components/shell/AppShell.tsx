"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ensureWorkspace, getWorkspace } from "@/lib/storage/local-repo";
import { useStatus } from "@/lib/stores/status";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";
import { githubApi, useGitHub } from "@/lib/github/session";
import { migrateLegacyRootWorkspace } from "@/lib/github/sync";
import { AutoSync } from "./AutoSync";
import { GitHubDialog } from "./GitHubDialog";
import { MoveFolderDialog } from "./MoveFolderDialog";
import { PillarsDialog } from "./PillarsDialog";
import { SearchDialog } from "./SearchDialog";
import { ShareDialog } from "./ShareDialog";
import { Sidebar } from "./Sidebar";
import { TemplatesDialog } from "./TemplatesDialog";
import { Toasts } from "./Toasts";
import { TrashDialog } from "./TrashDialog";
import { MentionsDialog } from "@/components/comments/MentionsDialog";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const workspace = useWorkspace((s) => s.workspace);
  const setWorkspace = useWorkspace((s) => s.setWorkspace);
  const sidebarOpen = useWorkspace((s) => s.sidebarOpen);
  const setSidebarOpen = useWorkspace((s) => s.setSidebarOpen);
  const setOnline = useStatus((s) => s.setOnline);
  const [error, setError] = useState<string | null>(null);
  const openDialog = useUI((s) => s.open);

  // Keep the workspace in the store in sync with IndexedDB (pillars, name, imports).
  const live = useLiveQuery(() => (workspace ? getWorkspace(workspace.id) : undefined), [workspace?.id]);
  useEffect(() => {
    if (!live || !workspace) return;
    const key = (w: typeof live) => JSON.stringify([w.name, w.pillars ?? []]);
    if (key(live) !== key(workspace)) setWorkspace(live);
  }, [live, workspace, setWorkspace]);

  // GitHub: learn whether sign-in is configured and who is signed in. After the OAuth redirect,
  // reopen the dialog the user started from (?github=connect|open) or explain an error (?github_error=…).
  const initGitHub = useGitHub((s) => s.init);
  const toast = useStatus((s) => s.toast);
  const tg = useTranslations("common.github");
  useEffect(() => {
    void initGitHub();
    const url = new URL(window.location.href);
    const reopen = url.searchParams.get("github");
    const error = url.searchParams.get("github_error");
    if (!reopen && !error) return;
    if (reopen === "connect" || reopen === "open") openDialog("github", { githubMode: reopen });
    if (error) toast(error === "denied" ? tg("errors.denied") : error === "not_configured" ? tg("unconfigured") : tg("errors.signInFailed"), "error");
    url.searchParams.delete("github");
    url.searchParams.delete("github_error");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, [initGitHub, openDialog, toast, tg]);

  // One-time: workspaces connected before folder support move from the repo root to GDD/ in game repos.
  const githubStatus = useGitHub((s) => s.status);
  useEffect(() => {
    if (githubStatus !== "signedIn" || workspace?.mode !== "github" || !workspace.repo || workspace.repo.dir !== undefined) return;
    const id = workspace.id;
    const repoName = `${workspace.repo.owner}/${workspace.repo.name}`;
    migrateLegacyRootWorkspace(githubApi(), id)
      .then(async (result) => {
        const updated = await getWorkspace(id);
        if (updated) setWorkspace(updated);
        if (result === "moved") toast(tg("autoMoved", { repo: repoName }));
      })
      .catch((err: unknown) => console.error("[sync] folder migration failed", err instanceof Error ? err.message : err));
  }, [githubStatus, workspace, setWorkspace, toast, tg]);

  // Ctrl/Cmd+K opens search from anywhere, including inside the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openDialog("search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDialog]);

  useEffect(() => {
    if (workspace) return;
    ensureWorkspace({
      title: t("welcome.title", { appName: t("app.name") }),
      markdown: t("welcome.body", { appName: t("app.name") }),
      workspaceName: t("shell.workspaceName"),
    })
      .then(setWorkspace)
      .catch((err: unknown) => {
        console.error(err);
        setError(String(err));
      });
  }, [workspace, setWorkspace, t]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [setOnline]);

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        {t("a11y.skipToContent")}
      </a>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" aria-hidden="true" onClick={() => setSidebarOpen(false)} />
      )}
      {/* URL params are runtime-only; Suspense lets the static shell prerender. */}
      <Suspense fallback={<div className="hidden w-64 md:block" aria-hidden="true" />}>
        <Sidebar />
      </Suspense>

      <main id="main" className="relative flex min-w-0 flex-1 flex-col bg-canvas md:my-2 md:me-2 md:rounded-xl md:border md:border-hairline">
        {error ? (
          <p role="alert" className="m-auto max-w-md p-6 text-center text-danger">
            {error}
          </p>
        ) : (
          // Always rendered so the route segment can prerender; pages wait for data themselves.
          <Suspense fallback={null}>{children}</Suspense>
        )}
      </main>
      <Toasts />
      <AutoSync />
      <Suspense fallback={null}>
        <SearchDialog />
        <TemplatesDialog />
        <TrashDialog />
        <PillarsDialog />
        <GitHubDialog />
        <ShareDialog />
        <MoveFolderDialog />
        <MentionsDialog />
      </Suspense>
    </div>
  );
}
