import { BRAND } from "@/config/brand";
import type { PageRecord, WorkspaceRecord } from "@/lib/model/schemas";
import { getDB } from "@/lib/storage/db";
import { listPages } from "@/lib/storage/local-repo";
import { bundleToJson, bundleToZip, pageFile, type WorkspaceBundle } from "./bundle";

export function fileSlug(s: string): string {
  return (
    s
      .toLocaleLowerCase("en")
      .replace(/ı/g, "i")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "untitled"
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function collectBundle(ws: WorkspaceRecord): Promise<WorkspaceBundle> {
  const pages = await listPages(ws.id);
  const assets = await getDB().assets.where("workspaceId").equals(ws.id).toArray();
  return {
    name: ws.name,
    pillars: ws.pillars ?? [],
    pages: pages.map(({ id, parentId, order, title, icon, kind, markdown }) => ({ id, parentId, order, title, icon, kind, markdown })),
    assets: await Promise.all(
      assets.map(async (a) => ({ path: a.path, mime: a.mime, data: new Uint8Array(await a.blob.arrayBuffer()) })),
    ),
  };
}

export async function exportWorkspaceZip(ws: WorkspaceRecord) {
  const zip = bundleToZip(await collectBundle(ws));
  downloadBlob(new Blob([zip as BlobPart], { type: "application/zip" }), `${BRAND.slug}-${fileSlug(ws.name)}-${today()}.zip`);
}

export async function exportWorkspaceJson(ws: WorkspaceRecord) {
  const json = bundleToJson(await collectBundle(ws));
  downloadBlob(new Blob([json], { type: "application/json" }), `${BRAND.slug}-${fileSlug(ws.name)}-${today()}.json`);
}

/** One page as a clean, Git-friendly Markdown file with front matter. */
export function exportPageMarkdown(page: PageRecord) {
  const text = pageFile({ ...page, markdown: page.markdown });
  downloadBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), `${fileSlug(page.title)}.md`);
}
