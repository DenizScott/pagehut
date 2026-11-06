"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CornerDownRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listPages } from "@/lib/storage/local-repo";
import { plainText } from "@/lib/search";

/** The lines of a page that link to `pageId`, as short plain-text excerpts (at most 2). */
export function linkContexts(markdown: string, pageId: string): string[] {
  const needle = `[[page:${pageId}`;
  return markdown
    .split("\n")
    .filter((line) => line.includes(needle))
    .slice(0, 2)
    .map((line) => {
      const text = plainText(line);
      return text.length > 140 ? `${text.slice(0, 137)}…` : text;
    })
    .filter(Boolean);
}

/** Pages that contain a [[link]] to this page. */
export function Backlinks({ pageId, workspaceId }: { pageId: string; workspaceId: string }) {
  const t = useTranslations("common");
  const backlinks = useLiveQuery(async () => {
    const needle = `[[page:${pageId}`;
    return (await listPages(workspaceId))
      .filter((p) => p.id !== pageId && p.markdown.includes(needle))
      .map((p) => ({ id: p.id, title: p.title, icon: p.icon, contexts: linkContexts(p.markdown, pageId) }));
  }, [pageId, workspaceId]);

  if (!backlinks?.length) return null;
  return (
    <aside aria-labelledby="backlinks-title" className="lk-no-print mt-10 border-t border-hairline pt-4 pb-16">
      <h2 id="backlinks-title" className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
        {t("page.backlinks", { count: backlinks.length })}
      </h2>
      <ul className="space-y-1">
        {backlinks.map((p) => (
          <li key={p.id}>
            <Link href={`/p/${p.id}`} className="block rounded-md px-1.5 py-1 text-sm hover:bg-surface-hover">
              <span className="flex items-center gap-2 font-medium text-fg">
                {p.icon ? <span aria-hidden="true">{p.icon}</span> : <CornerDownRight className="size-3.5 text-fg-muted" aria-hidden="true" />}
                {p.title || t("shell.untitled")}
              </span>
              {p.contexts.map((c, i) => (
                <span key={i} className="mt-0.5 block border-s-2 border-hairline ps-2 text-xs text-fg-muted">
                  {c}
                </span>
              ))}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
