import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { markdownToDoc } from "@/lib/markdown/parse";
import { AppDB, setDBForTests } from "./db";
import { createPage, ensureWorkspace, getPage, savePageTitle } from "./local-repo";
import { pendingKey, recoverPendingEdits, stashPending } from "./pending-edits";

// A minimal localStorage for the node test environment.
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
});
const keys = () => [...store.keys()];

describe("unsaved edits are recovered on the next start", () => {
  beforeEach(() => {
    setDBForTests(new AppDB(`test-${Math.random()}`));
    store.clear();
  });

  it("applies a stashed title and content, then clears the stash", async () => {
    const ws = await ensureWorkspace({ title: "Welcome", markdown: "Hi", workspaceName: "W" });
    const page = await createPage(ws.id, { title: "" });
    stashPending(pendingKey("title", page.id), "Saved at the last second");
    stashPending(pendingKey("content", page.id), markdownToDoc("Typed right before the tab closed."));

    expect(await recoverPendingEdits()).toEqual([page.id]);
    const after = await getPage(page.id);
    expect(after!.title).toBe("Saved at the last second");
    expect(after!.markdown).toContain("Typed right before the tab closed.");
    expect(keys()).toEqual([]);
  });

  it("ignores a stash when the page was saved later, or no longer exists", async () => {
    const ws = await ensureWorkspace({ title: "Welcome", markdown: "Hi", workspaceName: "W" });
    const page = await createPage(ws.id, { title: "Old" });
    stashPending(pendingKey("title", page.id), "Stale");
    await new Promise((r) => setTimeout(r, 5));
    await savePageTitle(page.id, "Newer, from another tab");
    stashPending(pendingKey("title", "01ZZZZZZZZZZZZZZZZZZZZZZZZ"), "Gone");

    expect(await recoverPendingEdits()).toEqual([]);
    expect((await getPage(page.id))!.title).toBe("Newer, from another tab");
    expect(keys()).toEqual([]);
  });
});
