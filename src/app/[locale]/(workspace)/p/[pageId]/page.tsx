import { PageView } from "@/components/shell/PageView";

/** Page content lives in IndexedDB, so the page id is read on the client (see PageView). */
export default function Page() {
  return <PageView />;
}
