"use client";

import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
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
  // Most dialogs here open from app state, not a Radix Trigger, so Radix can't return focus on
  // close. Remember what had focus when the dialog opened and give it back afterwards, unless
  // closing moved focus somewhere on purpose (e.g. into a page that a template just created).
  const [returnTo] = useState(() => (typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)));
  useEffect(
    () => () => {
      setTimeout(() => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if (lost && returnTo?.isConnected) returnTo.focus();
      }, 0);
    },
    [returnTo],
  );
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
