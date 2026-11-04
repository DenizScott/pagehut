import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { AppDB } from "./db";
import { migrateLegacyDatabases } from "./migrate";

const uid = () => Math.random().toString(36).slice(2);

async function seedLegacy(name: string) {
  const legacy = new AppDB(name);
  await legacy.workspaces.add({ id: "W1", name: "Old", mode: "local", createdAt: 1, updatedAt: 1 });
  await legacy.pages.add({
    id: "P1", workspaceId: "W1", parentId: null, order: 1, title: "Combat", doc: { type: "doc" },
    markdown: "# Combat\n", createdAt: 1, updatedAt: 1, dirty: true,
  });
  await legacy.kv.put({ key: "activeWorkspaceId", value: "W1" });
  legacy.close();
}

describe("legacy database migration", () => {
  it("copies workspaces, pages and settings and keeps the legacy DB", async () => {
    const legacyName = `legacy-${uid()}`;
    await seedLegacy(legacyName);
    const target = new AppDB(`pagehut-${uid()}`);

    expect(await migrateLegacyDatabases(target, [legacyName])).toBe(legacyName);
    expect(await target.pages.get("P1")).toMatchObject({ title: "Combat", markdown: "# Combat\n" });
    expect((await target.kv.get("activeWorkspaceId"))?.value).toBe("W1");
    expect(await Dexie.exists(legacyName)).toBe(true);
  });

  it("runs only once and never overwrites an existing workspace", async () => {
    const legacyName = `legacy-${uid()}`;
    await seedLegacy(legacyName);
    const target = new AppDB(`pagehut-${uid()}`);
    await target.workspaces.add({ id: "NEW", name: "Current", mode: "local", createdAt: 2, updatedAt: 2 });

    expect(await migrateLegacyDatabases(target, [legacyName])).toBeNull();
    expect(await target.pages.count()).toBe(0);
  });

  it("does nothing when no legacy database exists", async () => {
    const target = new AppDB(`pagehut-${uid()}`);
    expect(await migrateLegacyDatabases(target, [`missing-${uid()}`])).toBeNull();
  });
});
