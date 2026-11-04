"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ulid } from "ulid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Pillar } from "@/lib/model/schemas";
import { updateWorkspace } from "@/lib/storage/local-repo";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";

export const MAX_PILLARS = 6;

export function PillarsDialog() {
  const t = useTranslations("common.pillars");
  const open = useUI((s) => s.dialog === "pillars");
  const close = useUI((s) => s.close);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={t("title")} description={t("description")}>
          <PillarsForm onDone={close} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function PillarsForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("common.pillars");
  const workspace = useWorkspace((s) => s.workspace);
  const [items, setItems] = useState<Pillar[]>(() => workspace?.pillars ?? []);

  const update = (i: number, patch: Partial<Pillar>) => setItems((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const move = (i: number, d: -1 | 1) =>
    setItems((list) => {
      const next = [...list];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    const pillars = items
      .map((p) => ({ ...p, title: p.title.trim(), description: p.description?.trim() || undefined }))
      .filter((p) => p.title);
    await updateWorkspace(workspace.id, { pillars });
    onDone();
  }

  return (
    <form onSubmit={save} className="flex min-h-0 flex-col">
      <ol className="min-h-0 space-y-3 overflow-y-auto p-4">
        {items.map((p, i) => (
          <li key={p.id} className="rounded-lg border border-hairline bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">{i + 1}</span>
              <input
                value={p.title}
                onChange={(e) => update(i, { title: e.target.value })}
                aria-label={t("titleLabel", { n: i + 1 })}
                placeholder={t("titlePlaceholder")}
                maxLength={60}
                className="min-w-0 flex-1 rounded-md border border-hairline bg-canvas px-2 py-1 text-sm"
              />
              <Button size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("moveUp")}>
                <ArrowUp />
              </Button>
              <Button size="icon-sm" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={t("moveDown")}>
                <ArrowDown />
              </Button>
              <Button size="icon-sm" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label={t("remove")}>
                <Trash2 />
              </Button>
            </div>
            <textarea
              value={p.description ?? ""}
              onChange={(e) => update(i, { description: e.target.value })}
              aria-label={t("descriptionLabel", { n: i + 1 })}
              placeholder={t("descriptionPlaceholder")}
              rows={2}
              className="mt-2 w-full resize-none rounded-md border border-hairline bg-canvas px-2 py-1 text-sm"
            />
          </li>
        ))}
        {items.length < MAX_PILLARS && (
          <li>
            <Button variant="subtle" onClick={() => setItems((l) => [...l, { id: ulid(), title: "" }])}>
              <Plus /> {t("add")}
            </Button>
          </li>
        )}
      </ol>
      <div className="flex justify-end gap-2 border-t border-hairline p-3">
        <Button onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" variant="primary">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
