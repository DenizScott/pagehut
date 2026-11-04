"use client";

import { AlertCircle, Check, CloudOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useStatus } from "@/lib/stores/status";
import { cn } from "@/lib/utils";

export function SaveStatus() {
  const t = useTranslations("common.status");
  const save = useStatus((s) => s.save);
  const online = useStatus((s) => s.online);

  let Icon = Check;
  let label = t("savedLocally");
  let tone = "text-fg-subtle";
  if (save === "saving") {
    Icon = Loader2;
    label = t("saving");
  } else if (save === "error") {
    Icon = AlertCircle;
    label = t("error");
    tone = "text-danger";
  } else if (!online) {
    Icon = CloudOff;
    label = t("offline");
  }

  return (
    <p role="status" aria-label={t("label")} className={cn("flex items-center gap-1.5 text-xs whitespace-nowrap", tone)} data-save-state={save}>
      <Icon className={cn("size-3.5", save === "saving" && "animate-spin")} aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </p>
  );
}
