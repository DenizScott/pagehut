import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { AppDB, setDBForTests } from "./db";
import { createPage, ensureWorkspace, getPage, listPages, savePageContent, savePageTitle, trashPage } from "./local-repo";
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
