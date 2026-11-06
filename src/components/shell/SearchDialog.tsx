"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { FileText, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { createSearch } from "@/lib/search";
import { listPages } from "@/lib/storage/local-repo";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";
import { cn } from "@/lib/utils";

/** Ctrl/Cmd+K: search page titles and text across the workspace. */
export function SearchDialog() {
  const t = useTranslations("common");
  const open = useUI((s) => s.dialog === "search");
  const close = useUI((s) => s.close);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={t("search.title")} hideTitle className="top-[10vh] max-w-xl">
          <SearchBody onDone={close} />
        </DialogContent>
      )}
    </Dialog>
  );
}

function SearchBody({ onDone }: { onDone: () => void }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const listId = useId();
  const workspace = useWorkspace((s) => s.workspace);
  const pages = useLiveQuery(() => (workspace ? listPages(workspace.id) : []), [workspace?.id]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const search = useMemo(() => (pages ? createSearch(pages, locale) : null), [pages, locale]);
  const results = useMemo(() => {
    if (!pages) return [];
    if (!query.trim()) {
      return [...pages]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 8)
        .map((p) => ({ id: p.id, title: p.title, snippet: null as string | null }));
    }
    return search?.(query) ?? [];
  }, [pages, query, search]);

  const go = (id: string) => {
    onDone();
    router.push(`/p/${id}`);
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <Search className="size-4 text-fg-muted" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          aria-label={t("search.title")}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              go(results[active].id);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-subtle"
        />
      </div>
      <p className="px-4 pt-2 text-xs text-fg-subtle" aria-live="polite">
        {query.trim() ? t("search.count", { count: results.length }) : t("search.recent")}
      </p>
      {/* A listbox may only contain options, so the empty state sits outside it. */}
      {results.length === 0 && query.trim() && <p className="px-4 py-6 text-center text-sm text-fg-muted">{t("search.noResults")}</p>}
      <ul id={listId} role="listbox" aria-label={t("search.results")} className="min-h-0 overflow-y-auto p-2">
        {results.map((r, i) => (
          <li
            key={r.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(r.id)}
            className={cn("flex cursor-pointer gap-3 rounded-md px-2 py-2", i === active && "bg-surface-active")}
          >
            <FileText className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.title || t("shell.untitled")}</p>
              {r.snippet && <p className="line-clamp-2 text-xs text-fg-muted">{r.snippet}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
