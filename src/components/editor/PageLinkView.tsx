"use client";

import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { useLiveQuery } from "dexie-react-hooks";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageLink } from "@/lib/editor/page-link";
import { getPage } from "@/lib/storage/local-repo";
import { cn } from "@/lib/utils";

/** Shows the linked page's current title; a deleted target is shown struck through. */
function PageLinkView({ node, selected }: ReactNodeViewProps) {
  const t = useTranslations("editor.pageLink");
  const { id, title } = node.attrs as { id: string; title: string };
  // undefined while loading, null when the page doesn't exist.
  const target = useLiveQuery(async () => (await getPage(id)) ?? null, [id]);
  const missing = target === null || !!target?.deletedAt;
  const label = target && !target.deletedAt ? target.title || t("untitled") : title || t("missing");

  return (
    <NodeViewWrapper as="span" className="lk-page-link">
      <Link
        href={`/p/${id}`}
        data-page-link={id}
        title={missing ? t("missing") : undefined}
        className={cn(
          "inline-flex items-baseline gap-1 rounded px-0.5 font-medium text-fg underline decoration-hairline decoration-2 underline-offset-[3px] hover:bg-surface-hover hover:decoration-accent",
          selected && "bg-accent-soft",
          missing && "text-fg-subtle line-through",
        )}
        contentEditable={false}
      >
        {target?.icon ? <span aria-hidden="true">{target.icon}</span> : <FileText className="size-3.5 translate-y-0.5 self-center text-fg-muted" aria-hidden="true" />}
        {label}
      </Link>
    </NodeViewWrapper>
  );
}

/** Same schema as PageLink (lib/editor/page-link.ts); only the view differs. */
export const PageLinkWithView = PageLink.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },
});
