import { BRAND } from "@/config/brand";
import { loadMarkdown } from "@/lib/markdown/runtime";
import { getDB } from "./db";
import { listPages } from "./local-repo";

/**
 * Content the app created for a new workspace (the welcome page and the default workspace name)
 * follows the current language and wording, for as long as the user hasn't changed it. Anything
 * the user edited is left alone, and so are GitHub workspaces: teammates may use different
 * languages, and renaming shared files back and forth would only create commits.
 *
 * Returns what changed, so the open page can be reloaded.
 */
export async function localizeDefaults(
  workspaceId: string,
  current: { title: string; markdown: string; workspaceName: string },
): Promise<{ renamed: boolean; welcomePageIds: string[] }> {
  const result = { renamed: false, welcomePageIds: [] as string[] };
  const db = getDB();
  const ws = await db.workspaces.get(workspaceId);
  if (!ws || ws.mode !== "local") return result;
  const history = await import("./welcome-history");

  if (history.DEFAULT_WORKSPACE_NAMES.includes(ws.name) && ws.name !== current.workspaceName) {
    await db.workspaces.update(workspaceId, { name: current.workspaceName });
    result.renamed = true;
  }

  const fill = (s: string) => s.replace(/\{appName\}/g, BRAND.name);
  const titles = new Set(history.WELCOME_TITLES.map(fill));
  const candidates = (await listPages(workspaceId)).filter((p) => p.kind !== "database" && titles.has(p.title));
  if (!candidates.length) return result;

  const { markdownToDoc, docToMarkdown } = await loadMarkdown();
  const canonical = (md: string) => docToMarkdown(markdownToDoc(md));
  const generated = new Set(history.WELCOME_BODIES.map((b) => canonical(fill(b))));
  const wanted = canonical(current.markdown);
  for (const page of candidates) {
    if (page.title === current.title && page.markdown === wanted) continue; // already current
    if (!generated.has(page.markdown)) continue; // edited by the user: keep it
    const doc = markdownToDoc(current.markdown);
    await db.pages.update(page.id, { title: current.title, doc, markdown: docToMarkdown(doc), updatedAt: Date.now() });
    result.welcomePageIds.push(page.id);
  }
  return result;
}
