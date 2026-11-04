import { WorkspaceHome } from "@/components/shell/WorkspaceHome";

/** Client-only redirect to the first page in IndexedDB; nothing for the server to prefetch. */
export const instant = false;

export default function HomePage() {
  return <WorkspaceHome />;
}
