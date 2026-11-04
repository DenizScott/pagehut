"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { listTrash, restorePage } from "@/lib/storage/local-repo";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";

/** Trashed pages (with their subpages) can be restored. Nothing is permanently deleted here. */
export function TrashDialog() {
  const t = useTranslations("common");
  const format = useFormatter();
  const open = useUI((s) => s.dialog === "trash");
  const close = useUI((s) => s.close);
  const workspace = useWorkspace((s) => s.workspace);
  const trash = useLiveQuery(() => (workspace && open ? listTrash(workspace.id) : []), [workspace?.id, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={t("trash.title")} description={t("trash.description")}>
          <ul className="min-h-0 overflow-y-auto p-3">
            {trash?.length === 0 && <li className="px-2 py-6 text-center text-sm text-fg-muted">{t("trash.empty")}</li>}
            {trash?.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-hover">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.title || t("shell.untitled")}</p>
                  <p className="text-xs text-fg-subtle">
                    {t("trash.deletedAt", { time: format.relativeTime(p.deletedAt ?? Date.now()) })}
                  </p>
                </div>
                <Button size="sm" variant="subtle" onClick={() => void restorePage(p.id)}>
                  <RotateCcw /> {t("trash.restore")}
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      )}
    </Dialog>
  );
}
