import { isDatabaseBody, parseDatabase, serializeDatabase } from "@/lib/database/file";
import { mergeDatabase } from "@/lib/database/merge";
import type { DatabaseData } from "@/lib/database/types";
import { docToMarkdown } from "@/lib/markdown/serialize";
import { markdownToDoc } from "@/lib/markdown/parse";
import { mergeText, type MergeResult } from "@/lib/merge";
import type { PageKind } from "@/lib/model/schemas";
import { pageFile } from "@/lib/transfer/bundle";
import { parseFrontMatter } from "@/lib/transfer/frontmatter";

/**
 * pages/<id>.md <-> page content, for both kinds of page: documents (Markdown) and databases
 * (see src/lib/database/file.ts). Used by open, pull, conflict resolution, history and import.
 */

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export interface PageContent {
  title: string;
  icon?: string;
  kind?: PageKind;
  doc: unknown;
  markdown: string;
  database?: DatabaseData;
}

export function isDatabaseFile(meta: Record<string, unknown>, body: string): boolean {
  return meta.type === "database" || isDatabaseBody(body);
}

/** Content of a page from its file text (front matter + body). */
export function pageContentFromFile(text: string, fallbackTitle: string): PageContent {
  const { meta, body } = parseFrontMatter(text);
  const title = typeof meta.title === "string" ? meta.title : fallbackTitle;
  const icon = typeof meta.icon === "string" ? meta.icon : undefined;
  if (isDatabaseFile(meta, body)) {
    const { data } = parseDatabase(body);
    return { title, icon, kind: "database", doc: EMPTY_DOC, markdown: serializeDatabase(data), database: data };
  }
  const doc = markdownToDoc(body);
  return { title, icon, kind: undefined, doc, markdown: docToMarkdown(doc), database: undefined };
}

/** Three-way merge of a page file: by line for documents, by item and cell for databases. */
export function mergePageFile(id: string, base: string, mine: string, theirs: string): MergeResult {
  const b = parseFrontMatter(base);
  const m = parseFrontMatter(mine);
  const t = parseFrontMatter(theirs);
  if (!isDatabaseFile(m.meta, m.body) || !isDatabaseFile(t.meta, t.body)) return mergeText(base, mine, theirs);

  const field = (key: string) => {
    const [bv, mv, tv] = [b.meta[key], m.meta[key], t.meta[key]];
    if (mv === tv || tv === bv) return { ok: true, v: mv };
    if (mv === bv) return { ok: true, v: tv };
    return { ok: false, v: mv };
  };
  const title = field("title");
  const icon = field("icon");
  const data = mergeDatabase(parseDatabase(b.body).data, parseDatabase(m.body).data, parseDatabase(t.body).data);
  if (!title.ok || !icon.ok || !data.clean) return { clean: false, conflicts: (data.clean ? 0 : data.conflicts) + (title.ok ? 0 : 1) + (icon.ok ? 0 : 1) };
  const text = pageFile({
    id,
    parentId: null,
    order: 0,
    title: typeof title.v === "string" ? title.v : "",
    icon: typeof icon.v === "string" ? icon.v : undefined,
    kind: "database",
    markdown: serializeDatabase(data.data),
  });
  return { clean: true, text };
}
