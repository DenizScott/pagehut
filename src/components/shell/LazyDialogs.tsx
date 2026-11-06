"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentType } from "react";
import { useUI, type DialogName } from "@/lib/stores/ui";
import { SearchDialog } from "./SearchDialog";

/**
 * Workspace dialogs. Search is always mounted: it opens from the keyboard (Ctrl/Cmd+K) and people
 * type right away, so it must be ready in the same frame. The others open from a click and load
 * their code the first time, so the page doesn't wait for templates or the sync engine. Once
 * loaded, a dialog stays mounted so its open and close behave as before.
 */

const loadTemplates = () => import("./TemplatesDialog");

const LAZY: Record<Exclude<DialogName, "search" | null>, ComponentType> = {
  templates: dynamic(() => loadTemplates().then((m) => m.TemplatesDialog), { ssr: false }),
  trash: dynamic(() => import("./TrashDialog").then((m) => m.TrashDialog), { ssr: false }),
  pillars: dynamic(() => import("./PillarsDialog").then((m) => m.PillarsDialog), { ssr: false }),
  github: dynamic(() => import("./GitHubDialog").then((m) => m.GitHubDialog), { ssr: false }),
  share: dynamic(() => import("./ShareDialog").then((m) => m.ShareDialog), { ssr: false }),
  moveFolder: dynamic(() => import("./MoveFolderDialog").then((m) => m.MoveFolderDialog), { ssr: false }),
  mentions: dynamic(() => import("@/components/comments/MentionsDialog").then((m) => m.MentionsDialog), { ssr: false }),
};

export function LazyDialogs() {
  const dialog = useUI((s) => s.dialog);
  // Remember every dialog opened so far (adjusting state during render, not in an effect).
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  if (dialog && dialog !== "search" && !loaded.has(dialog)) setLoaded(new Set(loaded).add(dialog));

  // Templates is the most used of the lazy dialogs: fetch its code once the page is idle.
  useEffect(() => {
    const warm = () => void loadTemplates().catch(() => {});
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(warm, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 2000);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      <SearchDialog />
      {Object.entries(LAZY).map(([name, Dialog]) => (loaded.has(name) || name === dialog ? <Dialog key={name} /> : null))}
    </>
  );
}
