"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AtSign, Download, LayoutTemplate, MoreHorizontal, Plus, Search, Table2, Trash2, Upload, X } from "lucide-react";
import { useMentions } from "@/components/comments/MentionsDialog";
import { useGitHub } from "@/lib/github/session";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { useRouter } from "@/i18n/navigation";
import { createDatabase, createPage, listPages } from "@/lib/storage/local-repo";
import { emptyDatabase } from "@/lib/database/types";
import { exportWorkspaceJson, exportWorkspaceZip } from "@/lib/transfer/export";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";
import { cn } from "@/lib/utils";
import { useImporter } from "./Importer";
import { PageTree } from "./PageTree";
import { LocaleSwitcher, ThemeSwitcher } from "./Preferences";
import { StorageBadge, WorkspaceMenu } from "./WorkspaceMenu";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function Sidebar() {
  const t = useTranslations("common");
  const tdb = useTranslations("database");
  const router = useRouter();
  const params = useParams<{ pageId?: string }>();
  const workspace = useWorkspace((s) => s.workspace);
  const open = useWorkspace((s) => s.sidebarOpen);
  const setOpen = useWorkspace((s) => s.setSidebarOpen);
  const openDialog = useUI((s) => s.open);
  const pages = useLiveQuery(() => (workspace ? listPages(workspace.id) : []), [workspace?.id]);
  const importer = useImporter();

  async function onNewPage(parentId: string | null = null) {
    if (!workspace) return;
    const page = await createPage(workspace.id, { parentId });
    setOpen(false);
    router.push(`/p/${page.id}`);
  }

  async function onNewDatabase() {
    if (!workspace) return;
    const page = await createDatabase(workspace.id, { title: "", data: emptyDatabase({ name: tdb("defaults.name"), table: tdb("views.table") }) });
    setOpen(false);
    router.push(`/p/${page.id}`);
  }

  const mentionCount = useMentions()?.length ?? 0;
  const showMentions = useGitHub((s) => s.status === "signedIn") && workspace?.mode === "github";
  const quick: { key: string; icon: typeof Search; label: string; kbd?: string; badge?: number; run: () => void }[] = [
    { key: "search", icon: Search, label: t("shell.search"), kbd: isMac() ? "⌘K" : "Ctrl+K", run: () => openDialog("search") },
    ...(showMentions ? [{ key: "mentions", icon: AtSign, label: t("mentions.title"), badge: mentionCount, run: () => openDialog("mentions") }] : []),
    { key: "templates", icon: LayoutTemplate, label: t("shell.templates"), run: () => openDialog("templates") },
    { key: "trash", icon: Trash2, label: t("shell.trash"), run: () => openDialog("trash") },
  ];

  return (
    <aside
      aria-label={t("a11y.mainNav")}
      className={cn(
        "lk-no-print fixed inset-y-0 start-0 z-40 flex w-[264px] flex-col border-e border-hairline bg-surface-glass backdrop-blur-xl transition-transform md:static md:z-auto md:translate-x-0 md:border-0 md:bg-transparent md:backdrop-blur-none",
        open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
      )}
    >
      <div className="flex items-center gap-1 px-2 pt-2 pb-2">
        <WorkspaceMenu />
        <Button size="icon-sm" className="md:hidden" onClick={() => setOpen(false)} aria-label={t("a11y.closeSidebar")}>
          <X />
        </Button>
      </div>

      <StorageBadge />

      <div className="space-y-px px-2">
        {quick.map(({ key, icon: Icon, label, kbd, badge, run }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setOpen(false);
              run();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg"
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="flex-1 text-start">{label}</span>
            {kbd && <kbd className="font-sans text-xs text-fg-subtle">{kbd}</kbd>}
            {!!badge && (
              <span className="rounded-full bg-accent px-1.5 text-xs font-medium text-accent-fg tabular-nums" aria-label={t("mentions.count", { count: badge })}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{t("shell.pages")}</h2>
        <div className="flex">
          <Menu>
            <MenuTrigger className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label={t("transfer.menu")}>
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>{t("transfer.import")}</MenuLabel>
              <MenuItem onSelect={() => importer.pick()}>
                <Upload /> {t("transfer.importFiles")}
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>{t("transfer.exportWorkspace")}</MenuLabel>
              <MenuItem onSelect={() => workspace && void exportWorkspaceZip(workspace)}>
                <Download /> {t("transfer.exportZip")}
              </MenuItem>
              <MenuItem onSelect={() => workspace && void exportWorkspaceJson(workspace)}>
                <Download /> {t("transfer.exportJson")}
              </MenuItem>
            </MenuContent>
          </Menu>
          <Button size="icon-sm" onClick={() => void onNewPage()} aria-label={t("shell.newPage")} title={t("shell.newPage")}>
            <Plus />
          </Button>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {workspace && pages && (
          <PageTree
            workspaceId={workspace.id}
            pages={pages}
            activeId={params.pageId}
            onCreateChild={(parentId) => void onNewPage(parentId)}
            onNavigate={() => setOpen(false)}
          />
        )}
        <button
          type="button"
          onClick={() => void onNewPage()}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-subtle hover:bg-surface-hover hover:text-fg"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("shell.newPage")}
        </button>
        <button
          type="button"
          onClick={() => void onNewDatabase()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-subtle hover:bg-surface-hover hover:text-fg"
        >
          <Table2 className="size-4" aria-hidden="true" />
          {tdb("new")}
        </button>
      </nav>

      <div className="space-y-2 border-t border-hairline p-3">
        <ThemeSwitcher />
        <LocaleSwitcher />
      </div>
      {importer.input}
    </aside>
  );
}
