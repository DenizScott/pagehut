import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { bundleFromJson, bundleFromZip, bundleToJson, bundleToZip, remapIds, titleFromMarkdown, type WorkspaceBundle } from "./bundle";
import { parseFrontMatter, stringifyFrontMatter } from "./frontmatter";

const A = "01AAAAAAAAAAAAAAAAAAAAAAAA";
const B = "01BBBBBBBBBBBBBBBBBBBBBBBB";

const bundle: WorkspaceBundle = {
  name: "Oyunum",
  pillars: [{ id: "01PPPPPPPPPPPPPPPPPPPPPPPP", title: "Keşif" }],
  pages: [
    { id: A, parentId: null, order: 1, title: "Savaş: \"Sistem\"", icon: "⚔️", markdown: "See [[page:01BBBBBBBBBBBBBBBBBBBBBBBB|Levels]]\n" },
    { id: B, parentId: A, order: 1, title: "Levels", markdown: "# Inner heading\n" },
  ],
  assets: [{ path: "assets/abc-hero.png", mime: "image/png", data: new Uint8Array([1, 2, 3]) }],
};

describe("front matter", () => {
  it("round-trips titles with quotes, colons and Turkish characters", () => {
    const text = stringifyFrontMatter({ id: A, title: 'Savaş: "Sistem"', tags: ["a", "b"] }) + "Body\n";
    expect(parseFrontMatter(text)).toEqual({ meta: { id: A, title: 'Savaş: "Sistem"', tags: ["a", "b"] }, body: "Body\n" });
  });

  it("reads plain YAML from other tools and leaves files without front matter alone", () => {
    expect(parseFrontMatter("---\ntitle: Hello world\ndraft: true\n---\nX").meta).toEqual({ title: "Hello world", draft: true });
    expect(parseFrontMatter("# Just text\n")).toEqual({ meta: {}, body: "# Just text\n" });
  });
});

describe("workspace bundles", () => {
  it("ZIP export uses the repo layout and imports back losslessly", () => {
    const zip = bundleToZip(bundle);
    const back = bundleFromZip(zip, "x");
    expect(back.name).toBe("Oyunum");
    expect(back.pillars).toEqual(bundle.pillars);
    expect(back.pages).toEqual(bundle.pages);
    expect(back.assets[0]).toMatchObject({ path: "assets/abc-hero.png", mime: "image/png" });
  });

  it("JSON export imports back losslessly", () => {
    const back = bundleFromJson(bundleToJson(bundle));
    expect(back.pages).toEqual(bundle.pages);
    expect(Array.from(back.assets[0].data)).toEqual([1, 2, 3]);
  });

  it("rejects JSON that is not a workspace export", () => {
    expect(() => bundleFromJson('{"hello":1}')).toThrow();
  });

  it("imports a plain folder of Markdown files, folders becoming parent pages", () => {
    const zip = zipSync({
      "GDD/Combat.md": strToU8("# Combat\n\nHit things.\n"),
      "GDD/Levels/Forest.md": strToU8("---\ntitle: Forest level\n---\nTrees.\n"),
      "GDD/Levels.md": strToU8("# Levels\n\nOverview.\n"),
      "notes.md": strToU8("No heading here\n"),
    });
    const b = bundleFromZip(zip, "Imported");
    const byTitle = Object.fromEntries(b.pages.map((p) => [p.title, p]));
    expect(byTitle["Combat"].markdown).toBe("Hit things.\n");
    expect(byTitle["Combat"].parentId).toBe(byTitle["GDD"].id);
    expect(byTitle["Forest level"].parentId).toBe(byTitle["Levels"].id);
    expect(byTitle["Levels"].markdown).toBe("Overview.\n");
    expect(byTitle["notes"].markdown).toBe("No heading here\n");
  });

  it("remaps ids and page links on import", () => {
    let n = 0;
    const remapped = remapIds(bundle, () => `01NEW${String(++n).padStart(21, "0")}`);
    const [a, b] = remapped.pages;
    expect(a.id).not.toBe(A);
    expect(b.parentId).toBe(a.id);
    expect(a.markdown).toBe(`See [[page:${b.id}|Levels]]\n`);
  });

  it("derives a title from the first heading or the file name", () => {
    expect(titleFromMarkdown("# Pitch\n\nText\n", "x.md")).toEqual({ title: "Pitch", markdown: "Text\n" });
    expect(titleFromMarkdown("Intro\n# Later\n", "dir/My Notes.md").title).toBe("My Notes");
  });
});
