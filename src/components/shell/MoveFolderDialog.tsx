"use client";

import { FolderInput } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OfflineError, RateLimitError, RemoteChangedError, SignedOutError } from "@/lib/github/api";
import { githubApi } from "@/lib/github/session";
import { moveWorkspaceDir, pendingCount, pushWorkspace, RepoHasWorkspaceError } from "@/lib/github/sync";
import { getWorkspace } from "@/lib/storage/local-repo";
import { useStatus } from "@/lib/stores/status";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";

/** Moves a GitHub workspace to another folder of its repository (e.g. root → GDD/) in one commit. */
export function MoveFolderDialog() {
  const t = useTranslations("common.moveFolder");
  const open = useUI((s) => s.dialog === "moveFolder");
  const close = useUI((s) => s.close);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={t("title")} description={t("description")}>
          <MoveForm onDone={close} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function MoveForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations("common.moveFolder");
  const tg = useTranslations("common.github");
  const workspace = useWorkspace((s) => s.workspace);
  const setWorkspace = useWorkspace((s) => s.setWorkspace);
  const toast = useStatus((s) => s.toast);
  const current = workspace?.repo?.dir ?? "";
  const [folder, setFolder] = useState(current || "GDD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace?.repo) return;
    setBusy(true);
    setError(null);
    try {
      // Unpushed edits go first, so the move commit contains exactly what is on GitHub.
      if ((await pendingCount(workspace.id)) > 0) await pushWorkspace(githubApi(), workspace.id);
      await moveWorkspaceDir(githubApi(), workspace.id, folder);
      const updated = await getWorkspace(workspace.id);
      if (updated) setWorkspace(updated);
      toast(t("done", { folder: updated?.repo?.dir ? `${updated.repo.dir}/` : tg("repoRoot") }));
      onDone();
    } catch (err) {
      setError(
        err instanceof RepoHasWorkspaceError
          ? t("taken")
          : err instanceof RemoteChangedError
            ? t("remoteChanged")
            : err instanceof OfflineError
              ? tg("errors.offline")
              : err instanceof RateLimitError
                ? tg("errors.rateLimited", { time: new Date(err.resetAt).toLocaleTimeString() })
                : err instanceof SignedOutError
                  ? tg("errors.signedOut")
                  : err instanceof Error && err.message === "Invalid folder"
                    ? t("invalid")
                    : tg("errors.generic"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={run} className="space-y-3 p-4 text-sm">
      <p className="text-fg-muted">
        {t("current")}{" "}
        <code className="rounded bg-surface-hover px-1 font-mono text-xs">
          {workspace?.repo ? `${workspace.repo.owner}/${workspace.repo.name}/${current ? `${current}/` : ""}` : ""}
        </code>
      </p>
      <label className="flex items-center gap-2">
        <FolderInput className="size-4 text-fg-muted" aria-hidden="true" />
        <span>{t("newFolder")}</span>
        <input
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          placeholder={tg("repoRoot")}
          className="w-40 rounded-md border border-hairline bg-canvas px-2 py-1 font-mono text-xs"
        />
      </label>
      <p className="text-xs text-fg-subtle">{t("hint")}</p>
      {error && (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-danger">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onDone}>{t("cancel")}</Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? tg("working") : t("action")}
        </Button>
      </div>
    </form>
  );
}
