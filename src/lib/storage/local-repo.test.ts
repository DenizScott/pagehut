import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { AppDB, setDBForTests } from "./db";
import {
  createPage,
  ensureWorkspace,
  getPage,
  listPages,
  listTrash,
  movePage,
  restorePage,
  savePageContent,
  savePageTitle,
  trashPage,
} from "./local-repo";
import { markdownToDoc } from "@/lib/markdown/parse";

const welcome = { title: "Welcome", markdown: "# Hi\n\n- [ ] task\n", workspaceName: "My workspace" };

describe("local repository", () => {
  beforeEach(() => {
    setDBForTests(new AppDB(`test-${Math.random()}`));
  });

  it("creates a workspace with a welcome page once", async () => {
    const ws = await ensureWorkspace(welcome);
    const again = await ensureWorkspace(welcome);
    expect(again.id).toBe(ws.id);
    const pages = await listPages(ws.id);
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe("Welcome");
    expect(pages[0].markdown).toBe("# Hi\n\n- [ ] task\n");
  });

  it("saves content as doc + regenerated markdown and marks dirty", async () => {
    const ws = await ensureWorkspace(welcome);
    const page = await createPage(ws.id, { title: "Combat" });
    await savePageContent(page.id, markdownToDoc(":::callout warning\nRisk\n:::\n"));
    await savePageTitle(page.id, "Combat System");
    const saved = await getPage(page.id);
    expect(saved?.markdown).toBe(":::callout warning\nRisk\n:::\n");
    expect(saved?.title).toBe("Combat System");
    expect(saved?.dirty).toBe(true);
  });

  it("trashes and restores a whole subtree together", async () => {
    const ws = await ensureWorkspace(welcome);
    const parent = await createPage(ws.id, { title: "Levels" });
    const child = await createPage(ws.id, { title: "Forest", parentId: parent.id });
    await createPage(ws.id, { title: "Cave", parentId: child.id });

    await trashPage(parent.id);
    expect((await listPages(ws.id)).map((p) => p.title)).toEqual(["Welcome"]);
    expect((await listTrash(ws.id)).map((p) => p.title)).toEqual(["Levels"]);

    await restorePage(parent.id);
    expect((await listPages(ws.id)).map((p) => p.title).sort()).toEqual(["Cave", "Forest", "Levels", "Welcome"]);
    expect(await listTrash(ws.id)).toEqual([]);
  });

  it("restores a child to the top level when its parent is still in trash", async () => {
    const ws = await ensureWorkspace(welcome);
    const parent = await createPage(ws.id, { title: "Levels" });
    const child = await createPage(ws.id, { title: "Forest", parentId: parent.id });
    await trashPage(child.id);
    await trashPage(parent.id);
    await restorePage(child.id);
    expect((await getPage(child.id))?.parentId).toBeNull();
  });

  it("moves a page under another one", async () => {
    const ws = await ensureWorkspace(welcome);
    const a = await createPage(ws.id, { title: "A" });
    const b = await createPage(ws.id, { title: "B" });
    await movePage(b.id, { parentId: a.id, order: 1 });
    expect(await getPage(b.id)).toMatchObject({ parentId: a.id, order: 1 });
  });

  it("orders new pages after existing siblings and hides trashed pages", async () => {
    const ws = await ensureWorkspace(welcome);
    const a = await createPage(ws.id, { title: "A" });
    const b = await createPage(ws.id, { title: "B" });
    expect(b.order).toBeGreaterThan(a.order);
    await trashPage(a.id);
    const titles = (await listPages(ws.id)).map((p) => p.title);
    expect(titles).toEqual(["Welcome", "B"]);
  });
});
