import { strFromU8, strToU8, zipSync, type Zippable } from "fflate";
import { bundleFromIdFolders, isIdFolderExport, unzipAll } from "./folder-export";
import { BRAND } from "@/config/brand";
import { SCHEMA_VERSION, type PageKind, type Pillar, type WorkspaceFile } from "@/lib/model/schemas";
import { parseFrontMatter, stringifyFrontMatter } from "./frontmatter";

/**
 * Workspace <-> files. The ZIP layout is exactly the planned GitHub repo layout, so an exported
 * ZIP can be committed as-is and a cloned repo can be zipped and imported.
 */

export interface BundlePage {
  id: string;
  parentId: string | null;
  order: number;
  title: string;
  icon?: string;
  kind?: PageKind;
  markdown: string;
}

export interface BundleAsset {
  path: string;
  mime: string;
  data: Uint8Array;
}

export interface WorkspaceBundle {
  name: string;
  pillars: Pillar[];
  pages: BundlePage[];
  assets: BundleAsset[];
}

/** Page link syntax in Markdown: [[page:<ULID>|Title]] */
export const PAGE_LINK_RE = /\[\[page:([0-9A-HJKMNP-TV-Z]{26})(?:\|[^\]\n]*)?\]\]/g;

export function pageFile(page: BundlePage): string {
  return stringifyFrontMatter({ id: page.id, title: page.title, ...(page.icon ? { icon: page.icon } : {}), ...(page.kind ? { type: page.kind } : {}) }) + page.markdown;
}

export function workspaceFile(bundle: WorkspaceBundle): WorkspaceFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: bundle.name,
    tree: bundle.pages.map(({ id, parentId, order, title, icon, kind }) => ({ id, parentId, order, title, ...(icon ? { icon } : {}), ...(kind ? { kind } : {}) })),
    pillars: bundle.pillars,
    templates: [],
  };
}

export function bundleToZip(bundle: WorkspaceBundle): Uint8Array {
  const files: Zippable = {
    "workspace.json": strToU8(`${JSON.stringify(workspaceFile(bundle), null, 2)}\n`),
    "README.md": strToU8(
      `# ${bundle.name}\n\nExported from ${BRAND.name}. Pages are in \`pages/\` as Markdown; the page tree is in \`workspace.json\`.\n`,
    ),
  };
  for (const page of bundle.pages) files[`pages/${page.id}.md`] = strToU8(pageFile(page));
  for (const asset of bundle.assets) files[asset.path] = asset.data;
  return zipSync(files, { level: 6 });
}

export interface JsonBundle {
  format: "pagehut-workspace";
  version: 1;
  exportedAt: string;
  workspace: WorkspaceFile;
  pages: BundlePage[];
  assets: { path: string; mime: string; base64: string }[];
}

const toBase64 = (data: Uint8Array) => {
  let s = "";
  for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function bundleToJson(bundle: WorkspaceBundle): string {
  const json: JsonBundle = {
    format: "pagehut-workspace",
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: workspaceFile(bundle),
    pages: bundle.pages,
    assets: bundle.assets.map((a) => ({ path: a.path, mime: a.mime, base64: toBase64(a.data) })),
  };
  return JSON.stringify(json, null, 2);
}

export function bundleFromJson(text: string): WorkspaceBundle {
  const json = JSON.parse(text) as Partial<JsonBundle>;
  if (json.format !== "pagehut-workspace" || !Array.isArray(json.pages)) throw new Error("Not a workspace JSON export");
  return {
    name: json.workspace?.name ?? "Imported",
    pillars: json.workspace?.pillars ?? [],
    pages: json.pages.map((p) => ({ ...p, parentId: p.parentId ?? null })),
    assets: (json.assets ?? []).map((a) => ({ path: a.path, mime: a.mime, data: fromBase64(a.base64) })),
  };
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", avif: "image/avif",
};

/** Title for a Markdown file without front matter: first H1 (removed from the body), else the file name. */
export function titleFromMarkdown(markdown: string, fileName: string): { title: string; markdown: string } {
  const h1 = /^# +(.+?)\s*#*\s*$/m.exec(markdown);
  if (h1 && markdown.slice(0, h1.index).trim() === "") {
    return { title: h1[1].trim(), markdown: markdown.slice(h1.index + h1[0].length).replace(/^\s*\n/, "") };
  }
  return { title: fileName.replace(/\.(md|markdown)$/i, "").split("/").pop() ?? fileName, markdown };
}

/**
 * Reads a ZIP: our own export (workspace.json + pages/) or any folder of Markdown files, where
 * folders become parent pages. Images under assets/ come along.
 */
export function bundleFromZip(data: Uint8Array, fallbackName: string): WorkspaceBundle {
  const entries = unzipAll(data);
  const names = Object.keys(entries);
  // A folder export with ids in file names ("Page <32-hex id>.md"): see folder-export.ts.
  if (!names.some((n) => /(^|\/)workspace\.json$/.test(n)) && isIdFolderExport(names)) return bundleFromIdFolders(entries, fallbackName.replace(/\.zip$/i, ""));
  const assets: BundleAsset[] = names
    .filter((n) => /^(?:[^/]+\/)?assets\//.test(n))
    .map((n) => ({ path: n.replace(/^[^/]+\/(?=assets\/)/, ""), mime: MIME[n.split(".").pop()!.toLowerCase()] ?? "application/octet-stream", data: entries[n] }));

  const wsName = names.find((n) => /(^|\/)workspace\.json$/.test(n));
  if (wsName) {
    const ws = JSON.parse(strFromU8(entries[wsName])) as WorkspaceFile;
    const root = wsName.slice(0, -"workspace.json".length);
    const pages: BundlePage[] = ws.tree.map((node) => {
      const file = entries[`${root}pages/${node.id}.md`];
      const { meta, body } = parseFrontMatter(file ? strFromU8(file) : "");
      const kind = node.kind ?? (meta.type === "database" ? "database" : undefined);
      return { id: node.id, parentId: node.parentId, order: node.order, title: node.title, icon: node.icon, ...(kind ? { kind } : {}), markdown: body };
    });
    return { name: ws.name, pillars: ws.pillars ?? [], pages, assets };
  }

  // Generic folder of Markdown files.
  const mdFiles = names.filter((n) => /\.(md|markdown)$/i.test(n)).sort();
  const pages: BundlePage[] = [];
  const folderIds = new Map<string, string>();
  let counter = 0;
  const syntheticId = () => `IMPORT${String(++counter).padStart(20, "0")}`;

  const ensureFolder = (folder: string): string | null => {
    if (!folder) return null;
    const existing = folderIds.get(folder);
    if (existing) return existing;
    const parent = ensureFolder(folder.split("/").slice(0, -1).join("/"));
    const id = syntheticId();
    folderIds.set(folder, id);
    pages.push({ id, parentId: parent, order: pages.length + 1, title: folder.split("/").pop()!, markdown: "" });
    return id;
  };

  // Create folder pages first, so "Folder.md" can fill its folder's page whatever the file order.
  for (const name of mdFiles) ensureFolder(name.split("/").slice(0, -1).join("/"));

  for (const name of mdFiles) {
    const folder = name.split("/").slice(0, -1).join("/");
    const { meta, body } = parseFrontMatter(strFromU8(entries[name]));
    const derived = typeof meta.title === "string" ? { title: meta.title, markdown: body } : titleFromMarkdown(body, name);
    // "Folder.md" next to "Folder/" fills that folder's page instead of creating a sibling.
    const asFolder = folderIds.get(name.replace(/\.(md|markdown)$/i, ""));
    if (asFolder) {
      const fp = pages.find((p) => p.id === asFolder)!;
      Object.assign(fp, { title: derived.title, markdown: derived.markdown });
      continue;
    }
    pages.push({ id: syntheticId(), parentId: ensureFolder(folder), order: pages.length + 1, title: derived.title, markdown: derived.markdown });
  }
  return { name: fallbackName, pillars: [], pages, assets };
}

/**
 * Gives every imported page a fresh id and rewrites [[page:…]] links to match,
 * so importing the same export twice never collides with existing pages.
 */
export function remapIds(bundle: WorkspaceBundle, newId: () => string): WorkspaceBundle {
  const map = new Map(bundle.pages.map((p) => [p.id, newId()]));
  const relink = (md: string) =>
    md
      .replace(PAGE_LINK_RE, (full, id: string) => (map.has(id) ? full.replace(id, map.get(id)!) : full))
      // Database relations point at another database page by id.
      .replace(/"relationTo":"([0-9A-HJKMNP-TV-Z]{26})"/g, (full, id: string) => (map.has(id) ? full.replace(id, map.get(id)!) : full));
  return {
    ...bundle,
    pages: bundle.pages.map((p) => ({
      ...p,
      id: map.get(p.id)!,
      parentId: p.parentId ? (map.get(p.parentId) ?? null) : null,
      markdown: relink(p.markdown),
    })),
  };
}
