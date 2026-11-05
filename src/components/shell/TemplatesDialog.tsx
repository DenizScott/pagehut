"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useRouter } from "@/i18n/navigation";
import { createPage, fillEmptyPage } from "@/lib/storage/local-repo";
import { useUI } from "@/lib/stores/ui";
import { useWorkspace } from "@/lib/stores/workspace";
import { cn } from "@/lib/utils";
import { getTemplates, type Template, type TemplateCategory } from "@/templates";

const categories: TemplateCategory[] = ["plan", "design", "story", "production"];

/** Localized GDD template gallery. Fills the current page if it's empty, otherwise creates a new page. */
export function TemplatesDialog() {
  const t = useTranslations("common.templates");
  const open = useUI((s) => s.dialog === "templates");
  const close = useUI((s) => s.close);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <DialogContent title={t("title")} description={t("description")} className="max-w-3xl">
          <Gallery />
        </DialogContent>
      )}
    </Dialog>
  );
}

/** Headings of a template, used as a lightweight preview. */
function outline(markdown: string): string[] {
  return [...markdown.matchAll(/^#{2,3} +(.+)$/gm)].map((m) => m[1]).slice(0, 10);
}

function Gallery() {
  const t = useTranslations("common.templates");
  const locale = useLocale();
  const router = useRouter();
  const workspace = useWorkspace((s) => s.workspace);
  const { close, targetPageId, templateParentId, bumpContent } = useUI();
  const templates = useMemo(() => getTemplates(locale), [locale]);
  const [selected, setSelected] = useState<Template>(templates[0]);

  async function use(tpl: Template) {
    if (!workspace) return;
    const content = { title: tpl.title, markdown: tpl.markdown, icon: tpl.icon };
    if (targetPageId && (await fillEmptyPage(targetPageId, content))) {
      close();
      bumpContent();
      return;
    }
    const page = await createPage(workspace.id, { ...content, parentId: templateParentId });
    close();
    router.push(`/p/${page.id}`);
  }

  return (
    <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_16rem]">
      <div className="min-h-0 overflow-y-auto p-4 pt-3">
        {categories.map((cat) => (
          <section key={cat} aria-labelledby={`tpl-${cat}`} className="mb-4">
            <h3 id={`tpl-${cat}`} className="mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">
              {t(`categories.${cat}`)}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {templates
                .filter((tpl) => tpl.category === cat)
                .map((tpl) => (
                  <li key={tpl.id}>
                    <button
                      type="button"
                      data-template={tpl.id}
                      aria-pressed={selected.id === tpl.id}
                      onClick={() => setSelected(tpl)}
                      onDoubleClick={() => void use(tpl)}
                      className={cn(
                        "flex h-full w-full items-start gap-3 rounded-lg border border-hairline bg-surface p-3 text-start hover:border-accent",
                        selected.id === tpl.id && "border-accent ring-1 ring-accent",
                      )}
                    >
                      <span className="text-xl" aria-hidden="true">
                        {tpl.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{tpl.title}</span>
                        <span className="line-clamp-2 block text-xs text-fg-muted">{tpl.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <aside className="flex min-h-0 flex-col border-t border-hairline p-4 md:border-t-0 md:border-s" aria-label={t("preview")}>
        <p className="text-2xl" aria-hidden="true">
          {selected.icon}
        </p>
        <h3 className="mt-1 font-semibold">{selected.title}</h3>
        <p className="mt-1 text-sm text-fg-muted">{selected.description}</p>
        <p className="mt-4 mb-1 text-xs font-medium text-fg-subtle uppercase">{t("sections")}</p>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto text-sm text-fg-muted">
          {outline(selected.markdown).map((h) => (
            <li key={h} className="truncate">
              {h}
            </li>
          ))}
        </ul>
        <Button variant="primary" className="mt-4" onClick={() => void use(selected)}>
          {t("use")}
        </Button>
      </aside>
    </div>
  );
}
