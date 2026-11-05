"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Glass dialog panel. `title` is required: every dialog needs an accessible name. */
export function DialogContent({
  title,
  description,
  hideTitle,
  className,
  children,
  ...props
}: ComponentProps<typeof D.Content> & { title: string; description?: string; hideTitle?: boolean; children: ReactNode }) {
  const t = useTranslations("common.a11y");
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-(--backdrop)" />
      <D.Content
        {...props}
        // Without a description, opt out of aria-describedby explicitly (Radix convention).
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed start-1/2 top-[12vh] z-50 flex max-h-[76vh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 flex-col rounded-xl border border-hairline bg-surface-glass shadow-float backdrop-blur-xl rtl:translate-x-1/2",
          className,
        )}
      >
        <div className={cn("flex items-start gap-3 px-4 pt-4", hideTitle && "sr-only")}>
          <div className="min-w-0 flex-1">
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description && <D.Description className="mt-0.5 text-sm text-fg-muted">{description}</D.Description>}
          </div>
          <D.Close className="grid size-7 place-items-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label={t("dismiss")}>
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
