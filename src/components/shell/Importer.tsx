"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useStatus } from "@/lib/stores/status";
import { useWorkspace } from "@/lib/stores/workspace";
import { importFiles } from "@/lib/transfer/import";

/** Hidden file input + handler for importing .md, .zip and .json files into the workspace. */
export function useImporter() {
  const t = useTranslations("common.transfer");
  const router = useRouter();
  const workspace = useWorkspace((s) => s.workspace);
  const toast = useStatus((s) => s.toast);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(files: File[]) {
    if (!workspace || !files.length) return;
    try {
      const result = await importFiles(workspace.id, files);
      if (result.pages) toast(t("imported", { count: result.pages }));
      if (result.skipped.length) toast(t("skipped", { files: result.skipped.join(", ") }), "warning");
      if (result.firstPageId) router.push(`/p/${result.firstPageId}`);
    } catch (err) {
      console.error("[import]", err);
      toast(t("failed"), "error");
    }
  }

  return {
    pick: () => inputRef.current?.click(),
    input: (
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept=".md,.markdown,.txt,.csv,.zip,.json,text/markdown,text/csv,application/zip,application/json"
        data-testid="import-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void run(files);
        }}
      />
    ),
  };
}
