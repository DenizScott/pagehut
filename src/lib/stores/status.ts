import { create } from "zustand";

/**
 * Save/sync status shown in the top bar. P3 adds "syncing" | "synced" | "conflict".
 * Several savers run at once (title, content…); the status is "saved" only when none is pending.
 */
export type SaveState = "idle" | "saving" | "saved" | "error";

interface Toast {
  id: number;
  message: string;
  tone: "info" | "warning" | "error";
}

interface StatusStore {
  save: SaveState;
  lastSavedAt: number | null;
  online: boolean;
  toasts: Toast[];
  /** Savers with unsaved changes, by saver id. */
  pending: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  /**
   * Last real user input (typing, pasting, title edits), so background sync can leave the page being
   * typed in alone. Programmatic editor updates (normalization on load) don't count.
   */
  lastEditAt: number;
  noteUserEdit: () => void;
  /** The page open in the editor right now. */
  activePageId: string | null;
  setActivePage: (id: string | null) => void;
  markPending: (saverId: string) => void;
  markSaved: (saverId: string) => void;
  markFailed: (saverId: string) => void;
  setOnline: (online: boolean) => void;
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

function derive(pending: ReadonlySet<string>, failed: ReadonlySet<string>): SaveState {
  if (failed.size) return "error";
  if (pending.size) return "saving";
  return "saved";
}

const without = (set: ReadonlySet<string>, id: string) => {
  const next = new Set(set);
  next.delete(id);
  return next;
};

export const useStatus = create<StatusStore>((set) => ({
  save: "idle",
  lastSavedAt: null,
  online: true,
  toasts: [],
  pending: new Set(),
  failed: new Set(),
  lastEditAt: 0,
  activePageId: null,
  setActivePage: (activePageId) => set({ activePageId }),
  noteUserEdit: () => set({ lastEditAt: Date.now() }),
  markPending: (id) =>
    set((s) => {
      const pending = new Set(s.pending).add(id);
      return { pending, save: derive(pending, s.failed) };
    }),
  markSaved: (id) =>
    set((s) => {
      const pending = without(s.pending, id);
      const failed = without(s.failed, id);
      const save = derive(pending, failed);
      return { pending, failed, save, ...(save === "saved" ? { lastSavedAt: Date.now() } : {}) };
    }),
  markFailed: (id) =>
    set((s) => {
      const pending = without(s.pending, id);
      const failed = new Set(s.failed).add(id);
      return { pending, failed, save: derive(pending, failed) };
    }),
  setOnline: (online) => set({ online }),
  toast: (message, tone = "info") => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Pages that background sync may change now: not the one being typed in (unsaved or edited < 8 s ago). */
export function canTouchPage(pageId: string): boolean {
  const { activePageId, pending, lastEditAt } = useStatus.getState();
  return pageId !== activePageId || (pending.size === 0 && Date.now() - lastEditAt > 8000);
}
