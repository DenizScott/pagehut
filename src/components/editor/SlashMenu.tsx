"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SlashEntry, SlashGroup } from "./slash-items";

export interface SlashMenuProps {
  items: SlashEntry[];
  command: (item: SlashEntry) => void;
  labels: { menu: string; noResults: string; groups: Record<SlashGroup, string> };
}

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

/** Popup list for the `/` command. Keyboard: ↑ ↓ Enter Tab; Escape is handled by the extension. */
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu({ items, command, labels }, ref) {
  const [active, setActive] = useState(0);
  const [prevItems, setPrevItems] = useState(items);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset highlight when the filtered list changes (derived-state pattern, no effect needed).
  if (prevItems !== items) {
    setPrevItems(items);
    setActive(0);
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (!items.length) return false;
      if (event.key === "ArrowDown") {
        setActive((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        command(items[active]);
        return true;
      }
      return false;
    },
  }));

  let lastGroup: SlashGroup | null = null;

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={labels.menu}
      className="max-h-80 w-72 overflow-y-auto rounded-lg border border-hairline bg-surface-glass p-1 shadow-float backdrop-blur-xl"
    >
      {items.length === 0 && <p className="px-3 py-2 text-sm text-fg-muted">{labels.noResults}</p>}
      {items.map((item, index) => {
        const header = item.group !== lastGroup ? labels.groups[item.group] : null;
        lastGroup = item.group;
        const Icon = item.icon;
        return (
          <div key={item.id}>
            {header && <p className="px-2 pt-2 pb-1 text-xs font-medium text-fg-subtle">{header}</p>}
            <button
              type="button"
              role="option"
              aria-selected={index === active}
              data-index={index}
              data-slash-item={item.id}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => command(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start",
                index === active && "bg-surface-active",
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md border border-hairline bg-surface">
                <Icon className="size-4 text-fg-muted" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm text-fg">{item.title}</span>
                <span className="block truncate text-xs text-fg-muted">{item.description}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
});
