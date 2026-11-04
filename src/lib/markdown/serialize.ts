import type { Node as PMNode } from "@tiptap/pm/model";
import {
  MarkdownSerializer,
  defaultMarkdownSerializer,
  type MarkdownSerializerState,
} from "prosemirror-markdown";
import { getDocSchema } from "./schema";

/**
 * ProseMirror document → canonical Markdown (the file format committed to the repo).
 *
 * Extensions beyond CommonMark + GFM tables/strikethrough:
 *   ++underline++                       (markdown-it-ins)
 *   - [ ] / - [x] task items
 *   :::callout <variant> … :::           callout block
 *   :::toggle <summary text> … :::       toggle (details); summary is plain text
 * Nested containers get one extra colon per nesting level so the outer fence closes last.
 *
 * Known limits (documented in docs/ARCHITECTURE.md): table cells are flattened to one line
 * (multiple paragraphs are joined with a space, merged cells are split); toggle summaries lose
 * inline formatting. Text is never dropped.
 */

const CONTAINER_TYPES = new Set(["callout", "details"]);

function containerDepth(node: PMNode): number {
  let max = 0;
  node.forEach((child) => {
    const d = containerDepth(child) + (CONTAINER_TYPES.has(child.type.name) ? 1 : 0);
    if (d > max) max = d;
  });
  return max;
}

function fenceFor(node: PMNode): string {
  return ":".repeat(3 + containerDepth(node));
}

/** `flushClose` is public at runtime but marked @internal in prosemirror-markdown's typings. */
type StateInternals = { flushClose(size?: number): void };

/** Render a container: opening fence line, block content, closing fence. */
function renderContainer(state: MarkdownSerializerState, node: PMNode, info: string, content: PMNode) {
  const fence = fenceFor(node);
  state.write(`${fence}${info}\n`);
  state.renderContent(content);
  // Close the last block with a single newline so the fence sits directly under it.
  (state as unknown as StateInternals).flushClose(1);
  state.ensureNewLine();
  state.write(fence);
  state.closeBlock(node);
}

function inlineToSingleLine(node: PMNode): string {
  // Serialize a cell's blocks with the same serializer, then flatten to one table-safe line.
  const md = markdownSerializer.serialize(node, TIGHT);
  return md
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\|/g, "\\|");
}

function renderTable(state: MarkdownSerializerState, node: PMNode) {
  const rows: string[][] = [];
  node.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => {
      const text = inlineToSingleLine(cell);
      cells.push(text);
      const span = (cell.attrs.colspan as number) ?? 1;
      for (let i = 1; i < span; i++) cells.push("");
    });
    rows.push(cells);
  });
  const width = Math.max(1, ...rows.map((r) => r.length));
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] || " ").join(" | ")} |`;

  const separator = `|${Array.from({ length: width }, () => " --- ").join("|")}|`;
  const lines = rows.map(line);
  lines.splice(1, 0, separator);
  lines.forEach((l, i) => {
    if (i) state.ensureNewLine();
    state.write(l);
  });
  state.closeBlock(node);
}

function escapeAlt(s: string) {
  return s.replace(/[[\]\\]/g, "\\$&");
}

function escapeUrl(s: string) {
  return s.replace(/[()\s]/g, (c) => encodeURIComponent(c));
}

const d = defaultMarkdownSerializer;

export const markdownSerializer = new MarkdownSerializer(
  {
    doc: (state, node) => state.renderContent(node),
    paragraph: d.nodes.paragraph,
    text: d.nodes.text,
    heading(state, node) {
      state.write(`${"#".repeat(node.attrs.level as number)} `);
      state.renderInline(node, false);
      state.closeBlock(node);
    },
    blockquote: d.nodes.blockquote,
    codeBlock(state, node) {
      const backticks = node.textContent.match(/`{3,}/gm);
      const fence = backticks ? `${backticks.sort().slice(-1)[0]}\`` : "```";
      state.write(`${fence}${(node.attrs.language as string | null) ?? ""}\n`);
      state.text(node.textContent, false);
      state.write("\n");
      state.write(fence);
      state.closeBlock(node);
    },
    horizontalRule(state, node) {
      state.write("---");
      state.closeBlock(node);
    },
    hardBreak: d.nodes.hard_break,
    bulletList(state, node) {
      state.renderList(node, "  ", () => "- ");
    },
    orderedList(state, node) {
      const start = (node.attrs.start as number) ?? 1;
      const maxW = String(start + node.childCount - 1).length;
      const space = state.repeat(" ", maxW + 2);
      state.renderList(node, space, (i) => {
        const n = String(start + i);
        return `${state.repeat(" ", maxW - n.length)}${n}. `;
      });
    },
    listItem: (state, node) => state.renderContent(node),
    taskList(state, node) {
      state.renderList(node, "  ", () => "- ");
    },
    taskItem(state, node) {
      state.write(node.attrs.checked ? "[x] " : "[ ] ");
      state.renderContent(node);
    },
    image(state, node) {
      const alt = escapeAlt((node.attrs.alt as string | null) ?? "");
      const src = escapeUrl((node.attrs.src as string | null) ?? "");
      const title = node.attrs.title ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"` : "";
      state.write(`![${alt}](${src}${title})`);
      state.closeBlock(node);
    },
    table: renderTable,
    // Rows and cells are written by renderTable.
    tableRow: () => {},
    tableCell: () => {},
    tableHeader: () => {},
    callout(state, node) {
      renderContainer(state, node, `callout ${node.attrs.variant as string}`, node);
    },
    details(state, node) {
      const summary = node.firstChild?.textContent.replace(/\s+/g, " ").trim() ?? "";
      const content = node.lastChild?.type.name === "detailsContent" ? node.lastChild : node;
      renderContainer(state, node, `toggle${summary ? ` ${summary}` : ""}`, content);
    },
    detailsSummary: () => {},
    detailsContent: (state, node) => state.renderContent(node),
  },
  {
    italic: d.marks.em,
    bold: d.marks.strong,
    strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
    underline: { open: "++", close: "++", mixable: true, expelEnclosingWhitespace: true },
    code: d.marks.code,
    link: d.marks.link,
  },
  // tightLists is honored at runtime but missing from the constructor's typings.
  { tightLists: true, escapeExtraCharacters: /\+\+/g } as ConstructorParameters<typeof MarkdownSerializer>[2],
);

const TIGHT = { tightLists: true } as Parameters<MarkdownSerializer["serialize"]>[1];

/** Serialize a ProseMirror JSON document to Markdown. */
export function docToMarkdown(json: unknown): string {
  const doc = getDocSchema().nodeFromJSON(json);
  const out = markdownSerializer.serialize(doc, TIGHT);
  return out.length ? `${out}\n` : "";
}
