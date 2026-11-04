import MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";
import type StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import container from "markdown-it-container";
import ins from "markdown-it-ins";
import { MarkdownParser } from "prosemirror-markdown";
import { calloutVariants } from "@/lib/editor/callout";
import { getDocSchema } from "./schema";

/** Markdown (repo file body) → ProseMirror document. Inverse of ./serialize.ts. */

const TASK_RE = /^\[([ xX])\](?:\s+|$)/;

function createTokenizer(): MarkdownIt {
  const md = new MarkdownIt("commonmark", { html: false, linkify: false });
  md.enable(["table", "strikethrough"]);
  md.use(ins);
  md.inline.ruler.before("link", "page_link", pageLinkRule);
  md.use(container, "callout", { validate: (p: string) => /^callout(\s|$)/.test(p.trim()) });
  md.use(container, "toggle", { validate: (p: string) => /^toggle(\s|$)/.test(p.trim()) });
  md.core.ruler.push("lk_toggles", toggleRule);
  md.core.ruler.push("lk_tasks", taskRule);
  md.core.ruler.push("lk_cells", cellParagraphRule);
  md.core.ruler.push("lk_images", imageBlockRule);
  return md;
}

const PAGE_LINK_AT = /^\[\[page:([0-9A-HJKMNP-TV-Z]{26})(?:\|([^\]\n]*))?\]\]/;

/** `[[page:<ULID>|Title]]` → page_link token (inline atom). */
function pageLinkRule(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) return false;
  const m = PAGE_LINK_AT.exec(state.src.slice(state.pos));
  if (!m) return false;
  if (!silent) {
    const tok = state.push("page_link", "", 0);
    tok.attrSet("id", m[1]);
    tok.attrSet("title", m[2] ?? "");
  }
  state.pos += m[0].length;
  return true;
}

/** `:::toggle Summary` → details > detailsSummary(text) + detailsContent(blocks) */
function toggleRule(state: StateCore) {
  const out: Token[] = [];
  for (const tok of state.tokens) {
    if (tok.type === "container_toggle_open") {
      const summary = tok.info.trim().replace(/^toggle\s*/, "");
      out.push(new state.Token("details_open", "details", 1));
      out.push(new state.Token("details_summary_open", "summary", 1));
      const inline = new state.Token("inline", "", 0);
      inline.content = summary;
      const text = new state.Token("text", "", 0);
      text.content = summary;
      inline.children = summary ? [text] : [];
      out.push(inline);
      out.push(new state.Token("details_summary_close", "summary", -1));
      out.push(new state.Token("details_content_open", "div", 1));
    } else if (tok.type === "container_toggle_close") {
      out.push(new state.Token("details_content_close", "div", -1));
      out.push(new state.Token("details_close", "details", -1));
    } else {
      out.push(tok);
    }
  }
  state.tokens = out;
}

/** Bullet lists whose every item starts with `[ ]` / `[x]` become task lists. */
function taskRule(state: StateCore) {
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "bullet_list_open") continue;
    const level = tokens[i].level;
    const items: { open: number; close: number; inline: Token; match: RegExpMatchArray }[] = [];
    let end = -1;
    let ok = true;
    for (let j = i + 1; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.level === level && t.type === "bullet_list_close") {
        end = j;
        break;
      }
      if (t.level === level + 1 && t.type === "list_item_open") {
        const inline = tokens[j + 2];
        const match = tokens[j + 1]?.type === "paragraph_open" && inline?.type === "inline" ? inline.content.match(TASK_RE) : null;
        if (!match) {
          ok = false;
          continue;
        }
        let close = j + 1;
        while (!(tokens[close].type === "list_item_close" && tokens[close].level === level + 1)) close++;
        items.push({ open: j, close, inline, match });
      }
    }
    if (!ok || end < 0 || items.length === 0) continue;

    tokens[i].type = "task_list_open";
    tokens[end].type = "task_list_close";
    for (const { open, close, inline, match } of items) {
      tokens[open].type = "task_item_open";
      tokens[open].attrSet("checked", match[1] === " " ? "false" : "true");
      tokens[close].type = "task_item_close";
      // Strip the "[ ] " prefix from the inline content and its first text child.
      inline.content = inline.content.slice(match[0].length);
      const first = inline.children?.[0];
      if (first?.type === "text" && first.content.startsWith(match[0].trimEnd())) {
        first.content = first.content.slice(match[0].trimEnd().length).replace(/^\s+/, "");
        if (!first.content) inline.children!.shift();
      }
    }
  }
}

/** Table cells hold block content in our schema: wrap the cell's inline token in a paragraph. */
function cellParagraphRule(state: StateCore) {
  const out: Token[] = [];
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    out.push(t);
    if ((t.type === "th_open" || t.type === "td_open") && tokens[i + 1]?.type === "inline") {
      out.push(new state.Token("paragraph_open", "p", 1));
      out.push(tokens[++i]);
      out.push(new state.Token("paragraph_close", "p", -1));
    }
  }
  state.tokens = out;
}

/** Images are blocks in our schema: split paragraphs around image tokens. */
function imageBlockRule(state: StateCore) {
  const tokens = state.tokens;
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const inline = tokens[i + 1];
    if (t.type !== "paragraph_open" || inline?.type !== "inline" || !inline.children?.some((c) => c.type === "image")) {
      out.push(t);
      continue;
    }
    const close = tokens[i + 2];
    let run: Token[] = [];
    const flush = () => {
      // Drop runs that are only whitespace/softbreaks between images.
      if (run.some((c) => !(c.type === "softbreak" || (c.type === "text" && !c.content.trim())))) {
        out.push(new state.Token("paragraph_open", "p", 1));
        const inl = new state.Token("inline", "", 0);
        inl.children = run;
        inl.content = run.map((c) => c.content).join("");
        out.push(inl);
        out.push(new state.Token("paragraph_close", "p", -1));
      }
      run = [];
    };
    for (const child of inline.children!) {
      if (child.type === "image") {
        flush();
        const img = new state.Token("image_block", "img", 0);
        img.attrs = child.attrs;
        img.content = child.children?.map((c) => c.content).join("") ?? child.content;
        out.push(img);
      } else run.push(child);
    }
    flush();
    i += 2; // skip inline + paragraph_close
    void close;
  }
  state.tokens = out;
}

const nullIfEmpty = (s: string | null | undefined) => (s ? s : null);

let parser: MarkdownParser | null = null;

export function getMarkdownParser(): MarkdownParser {
  parser ??= new MarkdownParser(getDocSchema(), createTokenizer(), {
    blockquote: { block: "blockquote" },
    paragraph: { block: "paragraph" },
    list_item: { block: "listItem" },
    bullet_list: { block: "bulletList" },
    ordered_list: { block: "orderedList", getAttrs: (tok) => ({ start: Number(tok.attrGet("start")) || 1 }) },
    task_list: { block: "taskList" },
    task_item: { block: "taskItem", getAttrs: (tok) => ({ checked: tok.attrGet("checked") === "true" }) },
    heading: { block: "heading", getAttrs: (tok) => ({ level: Number(tok.tag.slice(1)) }) },
    code_block: { block: "codeBlock", noCloseToken: true },
    fence: { block: "codeBlock", getAttrs: (tok) => ({ language: nullIfEmpty(tok.info.trim()) }), noCloseToken: true },
    hr: { node: "horizontalRule" },
    image_block: {
      node: "image",
      getAttrs: (tok) => ({
        src: tok.attrGet("src"),
        alt: nullIfEmpty(tok.content),
        title: nullIfEmpty(tok.attrGet("title")),
      }),
    },
    hardbreak: { node: "hardBreak" },
    page_link: { node: "pageLink", getAttrs: (tok) => ({ id: tok.attrGet("id"), title: tok.attrGet("title") ?? "" }) },
    table: { block: "table" },
    thead: { ignore: true },
    tbody: { ignore: true },
    tr: { block: "tableRow" },
    th: { block: "tableHeader" },
    td: { block: "tableCell" },
    container_callout: {
      block: "callout",
      getAttrs: (tok) => {
        const v = tok.info.trim().split(/\s+/)[1] ?? "info";
        return { variant: (calloutVariants as readonly string[]).includes(v) ? v : "info" };
      },
    },
    details: { block: "details" },
    details_summary: { block: "detailsSummary" },
    details_content: { block: "detailsContent" },
    em: { mark: "italic" },
    strong: { mark: "bold" },
    s: { mark: "strike" },
    ins: { mark: "underline" },
    link: {
      mark: "link",
      getAttrs: (tok) => ({ href: tok.attrGet("href"), title: nullIfEmpty(tok.attrGet("title")) }),
    },
    code_inline: { mark: "code", noCloseToken: true },
  });
  return parser;
}

/** Parse Markdown into ProseMirror JSON. */
export function markdownToDoc(markdown: string): Record<string, unknown> {
  const doc = getMarkdownParser().parse(markdown);
  return doc.toJSON() as Record<string, unknown>;
}
