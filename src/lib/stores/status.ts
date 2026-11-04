import { create } from "zustand";

/**
 * Save/sync status shown in the top bar. P3 adds "syncing" | "synced" | "conflict".
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
  setSave: (s: SaveState) => void;
  setOnline: (online: boolean) => void;
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;

export const useStatus = create<StatusStore>((set) => ({
  save: "idle",
  lastSavedAt: null,
  online: true,
  toasts: [],
  setSave: (save) => set(save === "saved" ? { save, lastSavedAt: Date.now() } : { save }),
  setOnline: (online) => set({ online }),
  toast: (message, tone = "info") => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
