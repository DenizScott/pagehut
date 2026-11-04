import Dexie from "dexie";
import { BRAND } from "@/config/brand";
import { AppDB } from "./db";

const MIGRATED_KEY = "migratedFromLegacy";

/**
 * Copies local data from databases created under earlier product names into the current one.
 * Safe by design: runs only while the current database has no workspace, copies inside one
 * transaction, never deletes or modifies the legacy database, and records what it did.
 */
export async function migrateLegacyDatabases(
  target: AppDB,
  legacyNames: readonly string[] = BRAND.legacyDatabaseNames,
): Promise<string | null> {
  if ((await target.kv.get(MIGRATED_KEY)) || (await target.workspaces.count()) > 0) return null;

  for (const name of legacyNames) {
    if (name === target.name || !(await Dexie.exists(name))) continue;
    const legacy = new AppDB(name);
    try {
      await legacy.open();
      const [workspaces, pages, assets, kv] = await Promise.all([
        legacy.workspaces.toArray(),
        legacy.pages.toArray(),
        legacy.assets.toArray(),
        legacy.kv.toArray(),
      ]);
      if (workspaces.length === 0) continue;

      await target.transaction("rw", [target.workspaces, target.pages, target.assets, target.kv], async () => {
        await target.workspaces.bulkPut(workspaces);
        await target.pages.bulkPut(pages);
        await target.assets.bulkPut(assets);
        await target.kv.bulkPut(kv.filter((r) => r.key !== MIGRATED_KEY));
        await target.kv.put({ key: MIGRATED_KEY, value: { from: name, at: Date.now(), pages: pages.length } });
      });
      return name;
    } catch (err) {
      // A failed copy leaves the target untouched (transaction rollback) and the legacy DB intact.
      console.error(`[storage] migration from "${name}" failed`, err);
      return null;
    } finally {
      legacy.close();
    }
  }
  return null;
}
