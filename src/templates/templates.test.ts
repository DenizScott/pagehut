import { describe, expect, it } from "vitest";
import { docToMarkdown } from "@/lib/markdown/serialize";
import { markdownToDoc } from "@/lib/markdown/parse";
import { getTemplates, templateIds, templateLocales } from "./index";

describe("GDD templates", () => {
  it("ships all 14 templates in every launch language", () => {
    expect(templateIds).toHaveLength(14);
    for (const locale of ["tr", "en", "de"]) {
      expect(templateLocales).toContain(locale);
      const list = getTemplates(locale);
      expect(list.map((t) => t.id)).toEqual([...templateIds]);
      for (const t of list) {
        expect(t.title.trim(), `${locale}/${t.id} title`).not.toBe("");
        expect(t.description.trim(), `${locale}/${t.id} description`).not.toBe("");
      }
    }
  });

  it("each language has its own text, not a copy of English", () => {
    const en = getTemplates("en");
    for (const locale of ["tr", "de"]) {
      getTemplates(locale).forEach((t, i) => expect(t.markdown, `${locale}/${t.id}`).not.toBe(en[i].markdown));
    }
  });

  it("every template parses and serializes to stable Markdown", () => {
    for (const locale of templateLocales) {
      for (const t of getTemplates(locale)) {
        const once = docToMarkdown(markdownToDoc(t.markdown));
        const twice = docToMarkdown(markdownToDoc(once));
        expect(twice, `${locale}/${t.id}`).toBe(once);
        expect(once.length, `${locale}/${t.id} not empty`).toBeGreaterThan(50);
      }
    }
  });

  it("unknown locales fall back to English", () => {
    expect(getTemplates("fr")[0].title).toBe(getTemplates("en")[0].title);
  });
});
