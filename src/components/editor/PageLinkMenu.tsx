"use client";

import { FileText, Plus } from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";
import { cn } from "@/lib/utils";
import type { PopupHandle } from "./suggestion-popup";

export type PageLinkItem =
  | { kind: "page"; id: string; title: string; icon?: string; path?: string }
  | { kind: "create"; title: string };

export interface PageLinkMenuProps {
  items: PageLinkItem[];
  command: (item: PageLinkItem) => void;
  labels: { menu: string; noResults: string; create: (title: string) => string };
}

export const PageLinkMenu = forwardRef<PopupHandle, PageLinkMenuProps>(function PageLinkMenu({ items, command, labels }, ref) {
  const [active, setActive] = useState(0);
  const [prevItems, setPrevItems] = useState(items);
  if (prevItems !== items) {
    setPrevItems(items);
    setActive(0);
  }

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (!items.length) return false;
      if (event.key === "ArrowDown") return setActive((i) => (i + 1) % items.length), true;
      if (event.key === "ArrowUp") return setActive((i) => (i - 1 + items.length) % items.length), true;
      if (event.key === "Enter" || event.key === "Tab") return command(items[active]), true;
      return false;
    },
  }));

  return (
    <div role="listbox" aria-label={labels.menu} className="max-h-80 w-80 overflow-y-auto rounded-lg border border-hairline bg-surface-glass p-1 shadow-float backdrop-blur-xl">
      {items.length === 0 && <p className="px-3 py-2 text-sm text-fg-muted">{labels.noResults}</p>}
      {items.map((item, index) => (
        <button
          key={item.kind === "page" ? item.id : "create"}
          type="button"
          role="option"
          aria-selected={index === active}
          onMouseEnter={() => setActive(index)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
          className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm", index === active && "bg-surface-active")}
        >
          {item.kind === "page" ? (
            <>
              {item.icon ? <span aria-hidden="true">{item.icon}</span> : <FileText className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
              {item.path && <span className="max-w-[45%] truncate text-xs text-fg-subtle">{item.path}</span>}
            </>
          ) : (
            <>
              <Plus className="size-4 shrink-0 text-accent-text" aria-hidden="true" />
              <span className="truncate">{labels.create(item.title)}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
});
