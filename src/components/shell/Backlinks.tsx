"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { CornerDownRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { listPages } from "@/lib/storage/local-repo";

/** Pages that contain a [[link]] to this page. */
export function Backlinks({ pageId, workspaceId }: { pageId: string; workspaceId: string }) {
  const t = useTranslations("common");
  const backlinks = useLiveQuery(async () => {
    const needle = `[[page:${pageId}`;
    return (await listPages(workspaceId)).filter((p) => p.id !== pageId && p.markdown.includes(needle));
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
            <Link href={`/p/${p.id}`} className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-sm text-fg-muted hover:bg-surface-hover hover:text-fg">
              <CornerDownRight className="size-3.5" aria-hidden="true" />
              {p.title || t("shell.untitled")}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
