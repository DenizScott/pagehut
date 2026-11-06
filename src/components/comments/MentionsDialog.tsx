"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { mentions, type CommentsRecord } from "@/lib/comments/types";
import { useGitHub } from "@/lib/github/session";
import { listCommentRecords } from "@/lib/storage/comments";
import { listPages } from "@/lib/storage/local-repo";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";
import { CommentBody } from "./CommentsPanel";

export interface Mention {
  pageId: string;
  threadId: string;
  quote?: string;
  author: string;
  body: string;
  createdAt: number;
}

/** Open threads that mention `login` (newest first). */
export function findMentions(records: CommentsRecord[], login: string): Mention[] {
  if (!login) return [];
  const me = login.toLowerCase();
  const out: Mention[] = [];
  for (const rec of records) {
    for (const th of rec.threads) {
      if (th.resolved) continue;
      const c = [...th.comments].reverse().find((x) => x.author.toLowerCase() !== me && mentions(x.body).includes(me));
      if (c) out.push({ pageId: rec.pageId, threadId: th.id, quote: th.anchor?.exact, author: c.author, body: c.body, createdAt: c.createdAt });
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export function useMentions(): Mention[] | undefined {
  const workspace = useWorkspace((s) => s.workspace);
  const login = useGitHub((s) => s.user?.login) ?? "";
  return useLiveQuery(async () => (workspace && login ? findMentions(await listCommentRecords(workspace.id), login) : []), [workspace?.id, login]);
}

/** Inbox of open comments that mention the signed-in user, across the workspace. */
export function MentionsDialog() {
  const t = useTranslations("common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const router = useRouter();
  const open = useUI((s) => s.dialog === "mentions");
  const close = useUI((s) => s.close);
  const focusThread = useUI((s) => s.focusThread);
  const workspace = useWorkspace((s) => s.workspace);
  const signedIn = useGitHub((s) => s.status === "signedIn");
  const items = useMentions();
  const pages = useLiveQuery(() => (workspace && open ? listPages(workspace.id) : []), [workspace?.id, open]);
  const title = (id: string) => pages?.find((p) => p.id === id)?.title || t("shell.untitled");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={t("mentions.title")} description={t("mentions.description")}>
          <ul className="min-h-0 space-y-1 overflow-y-auto p-3">
            {!signedIn && <li className="px-2 py-6 text-center text-sm text-fg-muted">{t("mentions.signedOut")}</li>}
            {signedIn && items?.length === 0 && <li className="px-2 py-6 text-center text-sm text-fg-muted">{t("mentions.empty")}</li>}
            {items?.map((m) => (
              <li key={m.threadId}>
                <button
                  type="button"
                  onClick={() => {
                    focusThread({ pageId: m.pageId, threadId: m.threadId });
                    close();
                    router.push(`/p/${m.pageId}`);
                  }}
                  className="block w-full rounded-md px-2 py-1.5 text-start text-sm hover:bg-surface-hover"
                >
                  <span className="flex items-baseline gap-2 text-xs text-fg-subtle">
                    <span className="truncate font-medium text-fg">{title(m.pageId)}</span>
                    <span className="shrink-0">
                      @{m.author} · {format.relativeTime(new Date(m.createdAt), now)}
                    </span>
                  </span>
                  {m.quote && <span className="mt-0.5 block truncate border-s-2 border-accent ps-2 text-xs text-fg-muted">{m.quote}</span>}
                  <span className="mt-0.5 line-clamp-2 block text-fg">
                    <CommentBody body={m.body} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      )}
    </Dialog>
  );
}
