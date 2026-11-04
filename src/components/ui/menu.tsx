"use client";

import { DropdownMenu as M } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuSub = M.Sub;

export function MenuContent({ className, ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={4}
        collisionPadding={8}
        {...props}
        className={cn(
          "z-50 min-w-48 rounded-lg border border-hairline bg-surface-glass p-1 text-sm shadow-float backdrop-blur-xl",
          className,
        )}
      />
    </M.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      {...props}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-active [&_svg]:size-4 [&_svg]:text-fg-muted",
        className,
      )}
    />
  );
}

export function MenuSeparator() {
  return <M.Separator className="my-1 h-px bg-hairline" />;
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return <M.Label {...props} className={cn("px-2 pt-1.5 pb-1 text-xs font-medium text-fg-subtle", className)} />;
}
