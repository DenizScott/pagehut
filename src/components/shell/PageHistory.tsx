"use client";

import { History, RotateCcw } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { restorePageVersion } from "@/lib/github/pull";
import { inRepo, listFileCommits, readFileAt, type FileCommit, type RepoRef } from "@/lib/github/repo";
import { githubApi } from "@/lib/github/session";
import { pagePath } from "@/lib/github/sync";
import { parseFrontMatter } from "@/lib/transfer/frontmatter";
import { useSync } from "@/lib/stores/sync";
import { useUI } from "@/lib/stores/ui";
import { cn } from "@/lib/utils";

/** Last commits per page file, cached for the session (keyed by path + branch head). */
const cache = new Map<string, Promise<FileCommit[]>>();
function commitsFor(repo: RepoRef, pageId: string, headSha: string | null | undefined, perPage = 30) {
  const path = inRepo(repo, pagePath(pageId));
  const key = `${repo.owner}/${repo.name}@${headSha ?? ""}:${path}:${perPage}`;
  if (!cache.has(key)) cache.set(key, listFileCommits(githubApi(), repo, path, perPage).catch(() => []));
  return cache.get(key)!;
}

/** "Edited by @login · 2 hours ago" from GitHub (who committed the page last). */
export function LastEditor({ repo, pageId, headSha }: { repo: RepoRef; pageId: string; headSha?: string | null }) {
  const t = useTranslations("common.history");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [last, setLast] = useState<FileCommit | null>(null);

  useEffect(() => {
    let cancelled = false;
    void commitsFor(repo, pageId, headSha, 1).then((c) => !cancelled && setLast(c[0] ?? null));
    return () => {
      cancelled = true;
    };
  }, [repo, pageId, headSha]);

  if (!last) return null;
  return (
    <p className="hidden items-center gap-1.5 text-xs whitespace-nowrap text-fg-subtle lg:flex" title={last.message}>
      {/* eslint-disable-next-line @next/next/no-img-element -- GitHub avatar, tiny */}
      {last.avatarUrl && <img src={last.avatarUrl} alt="" className="size-4 rounded-full" />}
      {t("lastEdited", { author: last.author, time: format.relativeTime(new Date(last.date), now) })}
    </p>
  );
}

export function PageHistoryDialog({
  repo,
  pageId,
  workspaceId,
  headSha,
  open,
  onOpenChange,
}: {
  repo: RepoRef;
  pageId: string;
  workspaceId: string;
  headSha?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("common.history");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={t("title")} description={t("description")} className="max-w-3xl">
          <HistoryBody repo={repo} pageId={pageId} workspaceId={workspaceId} headSha={headSha} onDone={() => onOpenChange(false)} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function HistoryBody({ repo, pageId, workspaceId, headSha, onDone }: { repo: RepoRef; pageId: string; workspaceId: string; headSha?: string | null; onDone: () => void }) {
  const t = useTranslations("common.history");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const bumpContent = useUI((s) => s.bumpContent);
  const sync = useSync((s) => s.sync);
  const [commits, setCommits] = useState<FileCommit[] | null>(null);
  const [selected, setSelected] = useState<FileCommit | null>(null);
  // Content of the selected version, tagged with its commit so a stale result is never shown.
  const [loaded, setLoaded] = useState<{ sha: string; text: string | null } | null>(null);
  const text = loaded && loaded.sha === selected?.sha ? loaded.text : null;

  useEffect(() => {
    let cancelled = false;
    void commitsFor(repo, pageId, headSha).then((c) => {
      if (cancelled) return;
      setCommits(c);
      setSelected(c[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [repo, pageId, headSha]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const sha = selected.sha;
    void readFileAt(githubApi(), repo, inRepo(repo, pagePath(pageId)), sha).then((v) => !cancelled && setLoaded({ sha, text: v }));
    return () => {
      cancelled = true;
    };
  }, [selected, repo, pageId]);

  async function restore() {
    if (!text) return;
    await restorePageVersion(pageId, text);
    bumpContent();
    onDone();
    void sync(workspaceId);
  }

  return (
    <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[16rem_1fr]">
      <ul className="min-h-0 overflow-y-auto border-b border-hairline p-2 md:border-e md:border-b-0" aria-label={t("versions")}>
        {commits === null && <li className="p-2 text-sm text-fg-muted">{t("loading")}</li>}
        {commits?.length === 0 && <li className="p-2 text-sm text-fg-muted">{t("empty")}</li>}
        {commits?.map((c, i) => (
          <li key={c.sha}>
            <button
              type="button"
              aria-pressed={selected?.sha === c.sha}
              onClick={() => setSelected(c)}
              className={cn("flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start hover:bg-surface-hover", selected?.sha === c.sha && "bg-surface-active")}
            >
              <History className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{c.message}</span>
                <span className="block text-xs text-fg-muted">
                  {c.author} · {format.relativeTime(new Date(c.date), now)}
                  {i === 0 && ` · ${t("current")}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex min-h-0 flex-col">
        <pre className="min-h-40 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {text === null ? t("loading") : parseFrontMatter(text).body}
        </pre>
        <div className="flex justify-end border-t border-hairline p-3">
          <Button variant="primary" disabled={!text || selected?.sha === commits?.[0]?.sha} onClick={() => void restore()}>
            <RotateCcw /> {t("restore")}
          </Button>
        </div>
      </div>
    </div>
  );
}
