"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createPage, listPages } from "@/lib/storage/local-repo";
import { useWorkspace } from "@/lib/stores/workspace";

/** "/" opens the first page of the workspace (or creates one). */
export function WorkspaceHome() {
  const t = useTranslations("common.shell");
  const router = useRouter();
  const workspace = useWorkspace((s) => s.workspace);

  useEffect(() => {
    if (!workspace) return;
    let cancelled = false;
    (async () => {
      const pages = await listPages(workspace.id);
      const target = pages[0] ?? (await createPage(workspace.id));
      if (!cancelled) router.replace(`/p/${target.id}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace, router]);

  return (
    <p className="m-auto text-fg-muted" role="status">
      {t("loading")}
    </p>
  );
}
