import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { AppDB, setDBForTests } from "@/lib/storage/db";
import { ensureWorkspace, getWorkspace, listPages } from "@/lib/storage/local-repo";
import { bundleToZip, type WorkspaceBundle } from "./bundle";
import { importFiles } from "./import";

const welcome = { title: "Welcome", markdown: "Hi\n", workspaceName: "WS" };
const A = "01AAAAAAAAAAAAAAAAAAAAAAAA";
const B = "01BBBBBBBBBBBBBBBBBBBBBBBB";

const bundle: WorkspaceBundle = {
  name: "Export",
  pillars: [{ id: "01PPPPPPPPPPPPPPPPPPPPPPPP", title: "Keşif" }],
  pages: [
    { id: A, parentId: null, order: 1, title: "Combat", markdown: `Link to [[page:${B}|Bosses]]\n` },
    { id: B, parentId: A, order: 1, title: "Bosses", markdown: "- [ ] Design phase 2\n" },
  ],
  assets: [],
};

describe("import", () => {
  beforeEach(() => setDBForTests(new AppDB(`import-${Math.random()}`)));

  it("imports Markdown files with titles from front matter or the first heading", async () => {
    const ws = await ensureWorkspace(welcome);
    const files = [
      new File(["---\ntitle: Pitch\n---\nOne line.\n"], "a.md"),
      new File(["# Core loop\n\nExplore, loot, upgrade.\n"], "b.md"),
      new File(["binary"], "c.exe"),
    ];
    const r = await importFiles(ws.id, files);
    expect(r.pages).toBe(2);
    expect(r.skipped).toEqual(["c.exe"]);
    const titles = (await listPages(ws.id)).map((p) => p.title);
    expect(titles).toEqual(["Welcome", "Pitch", "Core loop"]);
  });

  it("imports a ZIP export twice without id collisions and keeps links working", async () => {
    const ws = await ensureWorkspace(welcome);
    const zip = new File([bundleToZip(bundle) as BlobPart], "export.zip");
    await importFiles(ws.id, [zip]);
    await importFiles(ws.id, [zip]);
    const pages = await listPages(ws.id);
    expect(pages).toHaveLength(5);
    const combat = pages.filter((p) => p.title === "Combat");
    expect(new Set(combat.map((p) => p.id)).size).toBe(2);
    for (const c of combat) {
      const child = pages.find((p) => p.parentId === c.id)!;
      expect(child.title).toBe("Bosses");
      expect(c.markdown).toBe(`Link to [[page:${child.id}|Bosses]]\n`);
    }
    expect((await getWorkspace(ws.id))?.pillars).toEqual(bundle.pillars);
  });
});
