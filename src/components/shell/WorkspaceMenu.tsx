"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronsUpDown, FolderGit2, FolderInput, GitBranch, HardDrive, LogOut, Share2, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useRouter } from "@/i18n/navigation";
import { repoUrl } from "@/lib/github/repo";
import { useGitHub } from "@/lib/github/session";
import { listWorkspaces, setActiveWorkspace } from "@/lib/storage/local-repo";
import { useSync } from "@/lib/stores/sync";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";
import { Logo } from "./Logo";

/** Brand + workspace switcher at the top of the sidebar. */
export function WorkspaceMenu() {
  const t = useTranslations("common");
  const router = useRouter();
  const workspace = useWorkspace((s) => s.workspace);
  const setWorkspace = useWorkspace((s) => s.setWorkspace);
  const setSidebarOpen = useWorkspace((s) => s.setSidebarOpen);
  const openDialog = useUI((s) => s.open);
  const github = useGitHub();
  const resetSync = useSync((s) => s.reset);
  const workspaces = useLiveQuery(listWorkspaces, []);

  async function switchTo(id: string) {
    const { workspace: ws, firstPageId } = await setActiveWorkspace(id);
    setWorkspace(ws);
    resetSync();
    setSidebarOpen(false);
    router.push(firstPageId ? `/p/${firstPageId}` : "/");
  }

  return (
    <Menu>
      <MenuTrigger
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-start hover:bg-surface-hover"
        aria-label={t("workspace.switch", { name: workspace?.name ?? "" })}
      >
        <Logo className="size-7 shrink-0" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold">{t("app.name")}</span>
          <span className="block truncate text-xs text-fg-muted">{workspace?.name ?? t("app.tagline")}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" aria-hidden="true" />
      </MenuTrigger>
      <MenuContent align="start" className="w-64">
        <MenuLabel>{t("workspace.title")}</MenuLabel>
        {workspaces?.map((ws) => (
          <MenuItem key={ws.id} onSelect={() => void switchTo(ws.id)}>
            {ws.mode === "github" ? <FolderGit2 /> : <HardDrive />}
            <span className="min-w-0 flex-1 truncate">{ws.name}</span>
            {ws.id === workspace?.id && <Check className="!text-accent-text" aria-label={t("workspace.current")} />}
          </MenuItem>
        ))}
        <MenuSeparator />
        {workspace?.mode !== "github" && (
          <MenuItem onSelect={() => openDialog("github", { githubMode: "connect" })}>
            <UploadCloud /> {t("github.connect")}
          </MenuItem>
        )}
        <MenuItem onSelect={() => openDialog("github", { githubMode: "open" })}>
          <GitBranch /> {t("github.open")}
        </MenuItem>
        {workspace?.mode === "github" && (
          <MenuItem onSelect={() => openDialog("share")}>
            <Share2 /> {t("share.title")}
          </MenuItem>
        )}
        {workspace?.mode === "github" && (
          <MenuItem onSelect={() => openDialog("moveFolder")}>
            <FolderInput /> {t("moveFolder.menu")}
          </MenuItem>
        )}
        {github.status === "signedIn" && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={() => void github.signOut()}>
              <LogOut /> {t("github.signOut", { login: github.user?.login ?? "" })}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

/** Where this workspace is stored: this browser, or a GitHub repository. */
export function StorageBadge() {
  const t = useTranslations("common");
  const workspace = useWorkspace((s) => s.workspace);
  const openDialog = useUI((s) => s.open);

  if (workspace?.mode === "github" && workspace.repo) {
    return (
      <a
        href={repoUrl(workspace.repo)}
        target="_blank"
        rel="noreferrer"
        className="mx-3 mb-2 flex items-center gap-1.5 rounded-md bg-surface-hover px-2 py-1 text-xs text-fg-muted hover:text-fg"
        title={t("github.repoHint")}
      >
        <FolderGit2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {workspace.repo.owner}/{workspace.repo.name}
          {workspace.repo.dir ? `/${workspace.repo.dir}` : ""}
        </span>
        <span className="sr-only"> ({t("a11y.newTab")})</span>
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openDialog("github", { githubMode: "connect" })}
      className="mx-3 mb-2 flex items-center gap-1.5 rounded-md bg-surface-hover px-2 py-1 text-start text-xs text-fg-muted hover:text-fg"
      title={t("shell.localModeHint")}
    >
      <HardDrive className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{t("shell.localMode")}</span>
      <span className="text-accent-text">{t("github.connectShort")}</span>
      <span className="sr-only">: {t("shell.localModeHint")}</span>
    </button>
  );
}
