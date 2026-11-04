import { create } from "zustand";

/** Workspace-level dialogs, opened from the sidebar, shortcuts or the editor. */
type DialogName = "search" | "templates" | "trash" | "pillars" | null;

interface OpenOptions {
  /** Templates: parent for a new page (null = top level). */
  templateParentId?: string | null;
  /** Templates: fill this existing page instead of creating one. */
  targetPageId?: string | null;
}

interface UIStore {
  dialog: DialogName;
  templateParentId: string | null;
  targetPageId: string | null;
  /** Bumped when page content is replaced outside the editor, so the open editor reloads. */
  contentVersion: number;
  open: (dialog: Exclude<DialogName, null>, opts?: OpenOptions) => void;
  close: () => void;
  bumpContent: () => void;
}

export const useUI = create<UIStore>((set) => ({
  dialog: null,
  templateParentId: null,
  targetPageId: null,
  contentVersion: 0,
  open: (dialog, opts) =>
    set({ dialog, templateParentId: opts?.templateParentId ?? null, targetPageId: opts?.targetPageId ?? null }),
  close: () => set({ dialog: null }),
  bumpContent: () => set((s) => ({ contentVersion: s.contentVersion + 1 })),
}));
