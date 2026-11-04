import { create } from "zustand";
import type { WorkspaceRecord } from "@/lib/model/schemas";

interface WorkspaceStore {
  workspace: WorkspaceRecord | null;
  sidebarOpen: boolean;
  setWorkspace: (ws: WorkspaceRecord) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useWorkspace = create<WorkspaceStore>((set) => ({
  workspace: null,
  sidebarOpen: false,
  setWorkspace: (workspace) => set({ workspace }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
