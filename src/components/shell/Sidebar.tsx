"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { FileText, HardDrive, Plus, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BRAND } from "@/config/brand";
import { Link, useRouter } from "@/i18n/navigation";
import { createPage, listPages } from "@/lib/storage/local-repo";
import { useWorkspace } from "@/lib/stores/workspace";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { LocaleSwitcher, ThemeSwitcher } from "./Preferences";

export function Sidebar() {
  const t = useTranslations("common");
  const router = useRouter();
  const params = useParams<{ pageId?: string }>();
  const workspace = useWorkspace((s) => s.workspace);
  const open = useWorkspace((s) => s.sidebarOpen);
  const setOpen = useWorkspace((s) => s.setSidebarOpen);
  const pages = useLiveQuery(() => (workspace ? listPages(workspace.id) : []), [workspace?.id]);

  async function onNewPage() {
    if (!workspace) return;
    const page = await createPage(workspace.id);
    setOpen(false);
    router.push(`/p/${page.id}`);
  }

  return (
    <aside
      aria-label={t("a11y.mainNav")}
      className={cn(
        "fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-hairline bg-surface-glass backdrop-blur-xl transition-transform md:static md:z-auto md:translate-x-0 md:border-0 md:bg-transparent md:backdrop-blur-none",
        open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
      )}
    >
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <Logo className="size-7" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{BRAND.name}</p>
          <p className="truncate text-xs text-fg-muted">{workspace?.name ?? t("app.tagline")}</p>
        </div>
        <Button size="icon-sm" className="md:hidden" onClick={() => setOpen(false)} aria-label={t("a11y.closeSidebar")}>
          <X />
        </Button>
      </div>

      <p
        className="mx-3 mb-2 flex items-center gap-1.5 rounded-md bg-surface-hover px-2 py-1 text-xs text-fg-muted"
        title={t("shell.localModeHint")}
      >
        <HardDrive className="size-3.5" aria-hidden="true" />
        {t("shell.localMode")}
        <span className="sr-only">: {t("shell.localModeHint")}</span>
      </p>

      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <h2 className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{t("shell.pages")}</h2>
        <Button size="icon-sm" onClick={onNewPage} aria-label={t("shell.newPage")} title={t("shell.newPage")}>
          <Plus />
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-px">
          {pages?.map((p) => {
            const active = params.pageId === p.id;
            return (
              <li key={p.id}>
                <Link
                  href={`/p/${p.id}`}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg",
                    active && "bg-surface-active font-medium text-fg",
                  )}
                >
                  {p.icon ? <span aria-hidden="true">{p.icon}</span> : <FileText className="size-4 shrink-0" aria-hidden="true" />}
                  <span className="truncate">{p.title || t("shell.untitled")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onNewPage}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-subtle hover:bg-surface-hover hover:text-fg"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("shell.newPage")}
        </button>
      </nav>

      <div className="space-y-2 border-t border-hairline p-3">
        <ThemeSwitcher />
        <LocaleSwitcher />
      </div>
    </aside>
  );
}
