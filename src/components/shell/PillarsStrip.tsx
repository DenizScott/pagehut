"use client";

import { Landmark, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";

/** The project's design pillars, visible above every page. */
export function PillarsStrip() {
  const t = useTranslations("common.pillars");
  const pillars = useWorkspace((s) => s.workspace?.pillars ?? []);
  const open = useUI((s) => s.open);

  return (
    <section aria-label={t("title")} className="lk-no-print flex items-center gap-2 overflow-x-auto border-b border-hairline px-3 py-1.5 text-xs md:px-4">
      <Landmark className="size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
      <span className="shrink-0 font-medium text-fg-muted">{t("title")}</span>
      {pillars.length === 0 ? (
        <button type="button" onClick={() => open("pillars")} className="truncate text-fg-subtle underline-offset-2 hover:text-fg hover:underline">
          {t("empty")}
        </button>
      ) : (
        <ol className="flex min-w-0 items-center gap-1.5">
          {pillars.map((p, i) => (
            <li key={p.id} title={p.description || undefined} className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-fg">
              <span className="sr-only">{i + 1}. </span>
              {p.title}
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={() => open("pillars")}
        className="ms-auto grid size-6 shrink-0 place-items-center rounded text-fg-subtle hover:bg-surface-hover hover:text-fg"
        aria-label={t("edit")}
        title={t("edit")}
      >
        <Pencil className="size-3.5" />
      </button>
    </section>
  );
}
