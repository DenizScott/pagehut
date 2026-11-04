import { describe, expect, it } from "vitest";
import { createSearch, plainText, snippet } from "./search";

const pages = [
  { id: "1", title: "Savaş Sistemi", markdown: "## Çekirdek döngü\n\n- [ ] Düşmanı yen\n", updatedAt: 1 },
  { id: "2", title: "Level Design: Forest", markdown: ":::callout warning\nThe **boss** arena is too small.\n:::\n", updatedAt: 2 },
  { id: "3", title: "Economy", markdown: "Gold drops scale with level. See [[page:01ARZ3NDEKTSV4RRFFQ69G5FAV|Savaş Sistemi]].\n", updatedAt: 3 },
];

describe("workspace search", () => {
  const search = createSearch(pages, "tr");

  it("finds titles regardless of case, accents and dotless ı", () => {
    expect(search("savas")[0].id).toBe("1");
    expect(search("SİSTEM")[0].id).toBe("1");
  });

  it("finds words in the body and returns a snippet", () => {
    const [hit] = search("boss");
    expect(hit.id).toBe("2");
    expect(hit.snippet).toContain("boss arena");
  });

  it("matches prefixes and ranks title hits first", () => {
    const ids = search("level").map((h) => h.id);
    expect(ids[0]).toBe("2");
    expect(ids).toContain("3");
  });

  it("requires all words and returns nothing for an empty query", () => {
    expect(search("boss gold")).toEqual([]);
    expect(search("   ")).toEqual([]);
  });

  it("strips Markdown syntax to plain text", () => {
    expect(plainText(pages[1].markdown)).toBe("The boss arena is too small.");
    expect(plainText(pages[2].markdown)).toBe("Gold drops scale with level. See Savaş Sistemi.");
    expect(plainText(pages[0].markdown)).toBe("Çekirdek döngü Düşmanı yen");
  });

  it("builds snippets around the first match", () => {
    expect(snippet("a".repeat(100) + " target word", "target", "en")).toMatch(/^….*target word$/);
  });
});
