"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Link } from "@/i18n/navigation";
import type { PageRecord } from "@/lib/model/schemas";
import { movePage, trashPage } from "@/lib/storage/local-repo";
import { ancestorsOf, buildTree, computeKeyboardMove, computeMove, flattenVisible, type DropPosition } from "@/lib/tree";
import { cn } from "@/lib/utils";

interface PageTreeProps {
  workspaceId: string;
  pages: PageRecord[];
  activeId?: string;
  onCreateChild: (parentId: string) => void;
  onNavigate: () => void;
}

const EXPANDED_KEY = (ws: string) => `pagehut:expanded:${ws}`;

/** Per-viewer UI convenience; storage may be unavailable (private mode), so failures are ignored. */
function loadExpanded(ws: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY(ws)) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveExpanded(ws: string, ids: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_KEY(ws), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export function PageTree({ workspaceId, pages, activeId, onCreateChild, onNavigate }: PageTreeProps) {
  const t = useTranslations("common");
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(workspaceId));
  const [drag, setDrag] = useState<{ id: string; over?: string; position?: DropPosition } | null>(null);

  // Keep the active page visible: expand its ancestors.
  const activeAncestors = useMemo(
    () => (activeId ? ancestorsOf(pages, activeId).map((p) => p.id) : []),
    [pages, activeId],
  );
  const [prevAncestors, setPrevAncestors] = useState<string[]>([]);
  if (activeAncestors.join() !== prevAncestors.join()) {
    setPrevAncestors(activeAncestors);
    if (activeAncestors.some((id) => !expanded.has(id))) setExpanded(new Set([...expanded, ...activeAncestors]));
  }

  useEffect(() => saveExpanded(workspaceId, expanded), [workspaceId, expanded]);

  const forest = useMemo(() => buildTree(pages), [pages]);
  const rows = useMemo(() => flattenVisible(forest, expanded), [forest, expanded]);

  const toggle = (id: string, open?: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  function positionFor(e: DragEvent<HTMLElement>): DropPosition {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
  }

  async function drop(targetId: string, position: DropPosition) {
    if (!drag) return;
    const move = computeMove(pages, drag.id, targetId, position);
    setDrag(null);
    if (!move) return;
    await movePage(drag.id, move);
    if (position === "inside") toggle(targetId, true);
  }

  async function keyboardMove(id: string, action: "up" | "down" | "indent" | "outdent") {
    const move = computeKeyboardMove(pages, id, action);
    if (!move) return;
    await movePage(id, move);
    if (move.parentId) toggle(move.parentId, true);
  }

  return (
    <ul className="space-y-px" aria-label={t("shell.pages")}>
      {rows.map(({ item: p, depth, children }) => {
        const active = activeId === p.id;
        const hasChildren = children.length > 0;
        const isOpen = expanded.has(p.id);
        const isOver = drag?.over === p.id;
        return (
          <li
            key={p.id}
            data-page-id={p.id}
            className="relative"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", p.id);
              setDrag({ id: p.id });
            }}
            onDragOver={(e) => {
              if (!drag || drag.id === p.id) return;
              e.preventDefault();
              const position = positionFor(e);
              if (drag.over !== p.id || drag.position !== position) setDrag({ ...drag, over: p.id, position });
            }}
            onDragLeave={() => drag?.over === p.id && setDrag({ id: drag.id })}
            onDrop={(e) => {
              e.preventDefault();
              void drop(p.id, positionFor(e));
            }}
            onDragEnd={() => setDrag(null)}
          >
            {isOver && drag?.position !== "inside" && (
              <span
                aria-hidden="true"
                className={cn("absolute inset-x-1 z-10 h-0.5 rounded bg-accent", drag?.position === "before" ? "-top-px" : "-bottom-px")}
              />
            )}
            <div
              className={cn(
                "group flex items-center gap-0.5 rounded-md pe-1 text-sm text-fg-muted hover:bg-surface-hover",
                active && "bg-surface-active text-fg",
                isOver && drag?.position === "inside" && "bg-accent-soft ring-1 ring-accent",
                drag?.id === p.id && "opacity-50",
              )}
              style={{ paddingInlineStart: `${depth * 14 + 2}px` }}
            >
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-label={isOpen ? t("tree.collapse") : t("tree.expand")}
                aria-expanded={hasChildren ? isOpen : undefined}
                className={cn("grid size-5 shrink-0 place-items-center rounded hover:bg-surface-active", !hasChildren && "invisible")}
                tabIndex={hasChildren ? 0 : -1}
              >
                <ChevronRight className={cn("size-3.5 transition-transform rtl:rotate-180", isOpen && "rotate-90 rtl:rotate-90")} />
              </button>
              <Link
                href={`/p/${p.id}`}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn("flex min-w-0 flex-1 items-center gap-2 py-1.5 hover:text-fg", active && "font-medium")}
                draggable={false}
              >
                {p.icon ? <span aria-hidden="true">{p.icon}</span> : <FileText className="size-4 shrink-0" aria-hidden="true" />}
                <span className="truncate">{p.title || t("shell.untitled")}</span>
              </Link>
              <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
                <Menu>
                  <MenuTrigger
                    className="grid size-6 place-items-center rounded hover:bg-surface-active"
                    aria-label={t("tree.actionsFor", { title: p.title || t("shell.untitled") })}
                  >
                    <MoreHorizontal className="size-4" />
                  </MenuTrigger>
                  <MenuContent align="start">
                    <MenuItem onSelect={() => onCreateChild(p.id)}>
                      <Plus /> {t("tree.addSubpage")}
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem onSelect={() => void keyboardMove(p.id, "up")}>
                      <ArrowUp /> {t("tree.moveUp")}
                    </MenuItem>
                    <MenuItem onSelect={() => void keyboardMove(p.id, "down")}>
                      <ArrowDown /> {t("tree.moveDown")}
                    </MenuItem>
                    <MenuItem onSelect={() => void keyboardMove(p.id, "indent")}>
                      <ArrowRight className="rtl:rotate-180" /> {t("tree.indent")}
                    </MenuItem>
                    <MenuItem onSelect={() => void keyboardMove(p.id, "outdent")}>
                      <ArrowLeft className="rtl:rotate-180" /> {t("tree.outdent")}
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem onSelect={() => void trashPage(p.id)} className="text-danger">
                      <Trash2 className="!text-danger" /> {t("shell.deletePage")}
                    </MenuItem>
                  </MenuContent>
                </Menu>
                <button
                  type="button"
                  onClick={() => onCreateChild(p.id)}
                  className="grid size-6 place-items-center rounded hover:bg-surface-active"
                  aria-label={t("tree.addSubpageTo", { title: p.title || t("shell.untitled") })}
                  title={t("tree.addSubpage")}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
