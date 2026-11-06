import { describe, expect, it } from "vitest";
import { databaseTemplateIds, getDatabaseTemplates } from "./databases";
import { automationSchema, propertySchema, viewSchema } from "@/lib/database/types";
import { cellText } from "@/lib/database/query";
import { docToMarkdown } from "@/lib/markdown/serialize";
import { markdownToDoc } from "@/lib/markdown/parse";
import { getTemplates, templateIds, templateLocales } from "./index";

describe("page templates", () => {
  it("ships all 20 templates (6 general, 14 game design) in every launch language", () => {
    expect(templateIds).toHaveLength(20);
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

describe("database templates", () => {
  it.each(["en", "tr", "de"])("are valid and consistent in %s", (locale) => {
    const all = getDatabaseTemplates(locale);
    expect(all.map((t) => t.id)).toEqual([...databaseTemplateIds]);
    for (const tpl of all) {
      const data = tpl.build();
      const props = new Map(data.properties.map((p) => [p.id, p]));
      for (const p of data.properties) expect(propertySchema.safeParse(p).success, `${tpl.id}.${p.id}`).toBe(true);
      for (const v of data.views) {
        expect(viewSchema.safeParse(v).success).toBe(true);
        if (v.groupBy) expect(props.get(v.groupBy)?.type).toBe("select");
        for (const d of [v.dateProperty, v.endProperty]) if (d) expect(props.get(d)?.type).toBe("date");
        for (const ref of [...v.filters.map((f) => f.propertyId), ...v.sorts.map((s) => s.propertyId), ...v.hidden]) expect(props.has(ref)).toBe(true);
      }
      for (const a of data.automations ?? []) {
        expect(automationSchema.safeParse(a).success, `${tpl.id} automation`).toBe(true);
        for (const ref of [a.trigger.kind === "rowAdded" ? null : a.trigger.propertyId, ...a.actions.map((x) => x.propertyId)]) if (ref) expect(props.has(ref)).toBe(true);
      }
      for (const row of data.rows) {
        for (const [pid, value] of Object.entries(row.cells)) {
          const p = props.get(pid);
          expect(p, `${tpl.id} cell ${pid}`).toBeDefined();
          if (p!.type === "select" || p!.type === "multiSelect") {
            for (const id of [value].flat()) expect(p!.options!.some((o) => o.id === id)).toBe(true);
          }
        }
        // Every formula computes a number for every sample row.
        for (const p of data.properties.filter((x) => x.type === "formula")) expect(cellText(data, row, p)).not.toBe("#ERR");
      }
      // Fresh ids each time.
      expect(tpl.build().rows[0]?.id).not.toBe(data.rows[0]?.id);
    }
  });
});
