import { describe, expect, it } from "vitest";
import tr from "../../../locales/tr/slash.json";
import { filterSlash, searchKey, slashItems, type SlashEntry } from "./slash-items";

const entries: SlashEntry[] = slashItems.map((item) => {
  const m = tr.items[item.id];
  return { ...item, title: m.title, description: m.description, haystack: searchKey([m.title, m.keywords, ...item.aliases].join(" "), "tr") };
});

describe("slash menu filtering", () => {
  it("matches Turkish titles regardless of case and accents", () => {
    expect(filterSlash(entries, "BAŞLIK", "tr").map((e) => e.id)).toEqual(expect.arrayContaining(["h1", "h2", "h3"]));
    expect(filterSlash(entries, "baslik", "tr").map((e) => e.id)).toContain("h1");
    expect(filterSlash(entries, "uyarı", "tr")[0].id).toBe("warning");
  });

  it("keeps English aliases working in other languages", () => {
    expect(filterSlash(entries, "todo", "tr")[0].id).toBe("todo");
    expect(filterSlash(entries, "h2", "tr")[0].id).toBe("h2");
  });

  it("returns everything for an empty query", () => {
    expect(filterSlash(entries, "", "tr")).toHaveLength(slashItems.length);
  });
});
