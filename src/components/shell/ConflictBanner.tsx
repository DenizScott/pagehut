"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { GitMerge } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { resolveConflict } from "@/lib/github/pull";
import { pageFileText } from "@/lib/github/sync";
import { lineDiff } from "@/lib/merge";
import { getPage } from "@/lib/storage/local-repo";
import { useSync } from "@/lib/stores/sync";
import { useUI } from "@/lib/stores/ui";
import { cn } from "@/lib/utils";

/**
 * Shown on a page that changed both here and on GitHub in the same lines. Nothing has been lost:
 * my text is in the editor, theirs is kept aside until I choose.
 */
export function ConflictBanner({ pageId }: { pageId: string }) {
  const t = useTranslations("common.conflict");
  const page = useLiveQuery(() => getPage(pageId), [pageId]);
  const bumpContent = useUI((s) => s.bumpContent);
  const sync = useSync((s) => s.sync);
  const [comparing, setComparing] = useState(false);
  const [confirming, setConfirming] = useState<"mine" | "theirs" | null>(null);
  const [busy, setBusy] = useState(false);

  if (!page?.conflict) return null;

  async function choose(choice: "mine" | "theirs") {
    if (!page) return;
    setBusy(true);
    await resolveConflict(page.id, choice);
    setComparing(false);
    setConfirming(null);
    if (choice === "theirs") bumpContent(); // the editor shows their version now
    setBusy(false);
    void sync(page.workspaceId);
  }

  const blocks = comparing ? numberLines(lineDiff(pageFileText(page), page.conflict.remoteText)) : [];

  return (
    <div role="alert" className="lk-no-print flex flex-wrap items-center gap-2 border-b border-hairline bg-warning-soft px-3 py-2 text-sm md:px-4">
      <GitMerge className="size-4 shrink-0 text-warning" aria-hidden="true" />
      {confirming ? (
        // Choosing without comparing drops one version, so it takes a second, explicit click.
        <>
          <p className="min-w-0 flex-1 font-medium">{confirming === "mine" ? t("confirmMine") : t("confirmTheirs")}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" onClick={() => void choose(confirming)} disabled={busy}>
              {confirming === "mine" ? t("keepMine") : t("keepTheirs")}
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setConfirming(null)} disabled={busy}>
              {t("cancel")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="min-w-0 flex-1">{t("message")}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="subtle" onClick={() => setComparing(true)} disabled={busy}>
              {t("compare")}
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setConfirming("mine")} disabled={busy}>
              {t("keepMine")}
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setConfirming("theirs")} disabled={busy}>
              {t("keepTheirs")}
            </Button>
          </div>
        </>
      )}

      <Dialog open={comparing} onOpenChange={setComparing}>
        {comparing && (
          <DialogContent title={t("compareTitle")} description={t("compareDescription")} className="max-w-3xl">
            <div className="min-h-0 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-[21px]">
              {blocks.map((b, i) => (
                <div
                  key={i}
                  className={cn(
                    "border-s-2",
                    b.kind === "same" && "border-transparent text-fg-muted",
                    b.kind === "mine" && "border-accent bg-accent-soft",
                    b.kind === "theirs" && "border-info bg-info-soft",
                  )}
                >
                  {b.kind !== "same" && (
                    <span className="block ps-12 pt-0.5 font-sans text-[11px] font-semibold uppercase">{b.kind === "mine" ? t("mine") : t("theirs")}</span>
                  )}
                  {b.lines.map((line, j) => (
                    <div key={j} className="flex">
                      {/* Line number in that version of the file. */}
                      <span className="w-10 shrink-0 pe-2 text-end text-fg-subtle select-none" aria-hidden="true">
                        {b.start + j}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap">{line || " "}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-hairline p-3">
              <Button onClick={() => void choose("mine")} disabled={busy}>
                {t("keepMine")}
              </Button>
              <Button variant="primary" onClick={() => void choose("theirs")} disabled={busy}>
                {t("keepTheirs")}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/** Adds each block's first line number, counted in the version the block belongs to. */
function numberLines(blocks: ReturnType<typeof lineDiff>) {
  let mine = 1;
  let theirs = 1;
  return blocks.map((b) => {
    const start = b.kind === "theirs" ? theirs : mine;
    if (b.kind !== "theirs") mine += b.lines.length;
    if (b.kind !== "mine") theirs += b.lines.length;
    return { ...b, start };
  });
}
