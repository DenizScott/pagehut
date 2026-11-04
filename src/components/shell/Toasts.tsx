"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStatus } from "@/lib/stores/status";
import { cn } from "@/lib/utils";

export function Toasts() {
  const toasts = useStatus((s) => s.toasts);
  const dismiss = useStatus((s) => s.dismiss);
  const t0 = useTranslations("common.a11y");
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 end-4 z-50 flex max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-lg border border-hairline bg-surface-glass p-3 text-sm shadow-float backdrop-blur-xl",
            t.tone === "warning" && "border-warning/40",
            t.tone === "error" && "border-danger/40",
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button type="button" onClick={() => dismiss(t.id)} className="text-fg-muted hover:text-fg" aria-label={t0("dismiss")}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
