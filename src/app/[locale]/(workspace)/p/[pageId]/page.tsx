import { PageView } from "@/components/shell/PageView";

/**
 * Page content lives in IndexedDB and is loaded on the client (see PageView), so the server
 * has nothing to prefetch: opt out of instant-navigation validation for this segment.
 */
export const instant = false;

export default function Page() {
  return <PageView />;
}
