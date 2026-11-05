"use client";

import { ExternalLink, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { collaboratorsUrl, installUrl, repoUrl } from "@/lib/github/repo";
import { useGitHub } from "@/lib/github/session";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";

/** Team access is GitHub access: explain it and link to the repo's collaborator settings. */
export function ShareDialog() {
  const t = useTranslations("common.share");
  const tApp = useTranslations("common.app");
  const open = useUI((s) => s.dialog === "share");
  const close = useUI((s) => s.close);
  const workspace = useWorkspace((s) => s.workspace);
  const appSlug = useGitHub((s) => s.appSlug);
  const repo = workspace?.repo;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={t("title")} description={t("description")}>
          {repo ? (
            <div className="space-y-3 p-4 text-sm">
              <ol className="list-decimal space-y-2 ps-5">
                <li>
                  {t("step1")}{" "}
                  <a href={collaboratorsUrl(repo)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-text underline underline-offset-2">
                    <Users className="size-3.5" aria-hidden="true" />
                    {t("collaborators")}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </li>
                <li>{t("step2")}</li>
                <li>{t("step3", { repo: `${repo.owner}/${repo.name}`, app: tApp("name") })}</li>
              </ol>
              <p className="rounded-md bg-surface-hover px-3 py-2 text-xs text-fg-muted">{t("permissions")}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <a href={repoUrl(repo)} target="_blank" rel="noreferrer" className="text-accent-text underline underline-offset-2">
                  {t("viewRepo")}
                </a>
                {appSlug && (
                  <a href={installUrl(appSlug)} target="_blank" rel="noreferrer" className="text-accent-text underline underline-offset-2">
                    {t("manageInstall")}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <p className="p-4 text-sm text-fg-muted">{t("localOnly")}</p>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
