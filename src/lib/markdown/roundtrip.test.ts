import { describe, expect, it } from "vitest";
import { docToMarkdown } from "./serialize";
import { markdownToDoc } from "./parse";

/**
 * Every block and mark in the editor schema must survive doc → Markdown → doc unchanged.
 * Cases are written in canonical Markdown: parse(md) must serialize back to exactly `md`,
 * and re-parsing must yield the identical document.
 */
const cases: Record<string, string> = {
  paragraph: "Hello world\n",
  "multiple paragraphs": "First\n\nSecond\n",
  headings: "# One\n\n## Two\n\n### Three\n",
  marks: "**bold** *italic* ~~strike~~ ++under++ `code`\n",
  // Tiptap's code mark excludes all other marks, so bold never wraps code.
  "nested marks": "***bold italic*** and **bold** `code`\n",
  link: '[PageHut](https://example.com "Title") and <https://example.org>\n',
  "hard break": "line one\\\nline two\n",
  "bullet list": "- one\n- two\n  - nested\n- three\n",
  "ordered list": "1. first\n2. second\n3. third\n",
  "ordered list start": "3. third\n4. fourth\n",
  "task list": "- [ ] open task\n- [x] done task\n",
  "task list nested": "- [ ] parent\n  - [x] child\n",
  "empty task": "- [ ] \n- [x] done\n",
  "multi-paragraph list item": "- first para\n\n  second para\n- next\n",
  blockquote: "> quoted\n>\n> two\n",
  "code block": "```ts\nconst a = 1;\n```\n",
  "code block without language": "```\nplain\n```\n",
  "code block containing fence": "````md\n```js\nx\n```\n````\n",
  divider: "Above\n\n---\n\nBelow\n",
  image: '![Concept art](assets/abc-hero.png "Hero")\n',
  "image between text": "Before\n\n![](assets/x.png)\n\nAfter\n",
  table: "| Stat | Value |\n| --- | --- |\n| HP | 100 |\n| Speed | *fast* |\n",
  "table with pipe": "| A | B |\n| --- | --- |\n| a \\| b | c |\n",
  callout: ":::callout warning\nScope risk: **cut** if late.\n:::\n",
  "callout info": ":::callout info\nNote\n:::\n",
  toggle: ":::toggle Why this matters\nBecause.\n\n- item\n:::\n",
  "toggle empty summary": ":::toggle\nBody\n:::\n",
  "nested containers": "::::callout idea\nOuter\n\n:::toggle Inner\nDeep\n:::\n::::\n",
  "callout in list": "- item\n\n  :::callout info\n  inside\n  :::\n",
  "escaped specials": "1\\. not a list and \\*not italic\\* and a\\++b\n",
  "turkish text": "Çekirdek döngü: keşfet → topla → geliştir. İğdır, ğüşıöç.\n",
  empty: "",
};

describe("markdown round-trip", () => {
  for (const [name, md] of Object.entries(cases)) {
    it(name, () => {
      const doc = markdownToDoc(md);
      const out = docToMarkdown(doc);
      expect(out).toBe(md);
      expect(markdownToDoc(out)).toEqual(doc);
    });
  }

  it("parses task items as taskItem nodes with checked state", () => {
    const doc = markdownToDoc("- [x] done\n") as { content: { type: string; content: { attrs: { checked: boolean } }[] }[] };
    expect(doc.content[0].type).toBe("taskList");
    expect(doc.content[0].content[0].attrs.checked).toBe(true);
  });

  it("keeps a mixed list as a bullet list (no partial task conversion)", () => {
    const doc = markdownToDoc("- [ ] a\n- b\n") as { content: { type: string }[] };
    expect(doc.content[0].type).toBe("bulletList");
  });

  it("splits an inline image out of a paragraph without losing text", () => {
    const md = docToMarkdown(markdownToDoc("See ![x](a.png) here\n"));
    expect(md).toContain("See");
    expect(md).toContain("![x](a.png)");
    expect(md).toContain("here");
  });

  it("flattens multi-paragraph table cells without dropping text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            { type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H" }] }] }] },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "one" }] },
                    { type: "paragraph", content: [{ type: "text", text: "two" }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(docToMarkdown(doc)).toBe("| H |\n| --- |\n| one two |\n");
  });

  it("unknown callout variants fall back to info", () => {
    const doc = markdownToDoc(":::callout banana\nx\n:::\n") as { content: { attrs: { variant: string } }[] };
    expect(doc.content[0].attrs.variant).toBe("info");
  });
});
