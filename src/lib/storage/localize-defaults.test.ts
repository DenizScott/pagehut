import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import en from "../../../locales/en/common.json";
import tr from "../../../locales/tr/common.json";
import { AppDB, getDB, setDBForTests } from "./db";
import { ensureWorkspace, getPage, listPages, savePageContent, savePageTitle } from "./local-repo";
import { localizeDefaults } from "./localize-defaults";
import { WELCOME_BODIES } from "./welcome-history";
import { markdownToDoc } from "@/lib/markdown/parse";

const fill = (s: string) => s.replace(/\{appName\}/g, "PageHut");
const content = (c: typeof en) => ({ title: fill(c.welcome.title), markdown: fill(c.welcome.body), workspaceName: c.shell.workspaceName });
// The first English welcome text, from when PageHut was only for game design documents.
const oldEnglish = WELCOME_BODIES.find((b) => b.includes("game design documents**"))!;

describe("defaults follow the language while untouched", () => {
  beforeEach(() => {
    setDBForTests(new AppDB(`test-${Math.random()}`));
  });

  it("updates an old, untouched welcome page and default name to the current language", async () => {
    const ws = await ensureWorkspace({ title: "Welcome to PageHut", markdown: fill(oldEnglish), workspaceName: "My game" });
    const r = await localizeDefaults(ws.id, content(tr));
    expect(r.renamed).toBe(true);
    expect(r.welcomePageIds).toHaveLength(1);
    expect((await getDB().workspaces.get(ws.id))!.name).toBe("Çalışma alanım");
    const [page] = await listPages(ws.id);
    expect(page.title).toBe("PageHut uygulamasına hoş geldin");
    expect(page.markdown).toContain("yazdığın ve planladığın her şey");
    // Nothing more to do the second time.
    expect(await localizeDefaults(ws.id, content(tr))).toEqual({ renamed: false, welcomePageIds: [] });
  });

  it("keeps what the user changed", async () => {
    const ws = await ensureWorkspace(content(en));
    const [page] = await listPages(ws.id);
    await savePageContent(page.id, markdownToDoc(`${fill(en.welcome.body)}\nMy own note.\n`));
    await getDB().workspaces.update(ws.id, { name: "Channel scripts" });
    const r = await localizeDefaults(ws.id, content(tr));
    expect(r).toEqual({ renamed: false, welcomePageIds: [] });
    expect((await getPage(page.id))!.markdown).toContain("My own note.");

    // A renamed welcome page is left alone too.
    await savePageTitle(page.id, "Start here");
    expect((await localizeDefaults(ws.id, content(tr))).welcomePageIds).toEqual([]);
  });

  it("leaves GitHub workspaces alone", async () => {
    const ws = await ensureWorkspace(content(en));
    await getDB().workspaces.update(ws.id, { mode: "github" });
    expect(await localizeDefaults(ws.id, content(tr))).toEqual({ renamed: false, welcomePageIds: [] });
  });
});
