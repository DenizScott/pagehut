import Dexie, { type EntityTable } from "dexie";
import type { AssetRecord, PageRecord, WorkspaceRecord } from "@/lib/model/schemas";
import { BRAND } from "@/config/brand";

export interface KvRecord {
  key: string;
  value: unknown;
}

export class AppDB extends Dexie {
  workspaces!: EntityTable<WorkspaceRecord, "id">;
  pages!: EntityTable<PageRecord, "id">;
  assets!: EntityTable<AssetRecord, "path">;
  kv!: EntityTable<KvRecord, "key">;

  constructor(name: string = BRAND.slug) {
    super(name);
    // Only indexed fields are listed (booleans and null are not valid IndexedDB keys).
    // Add a new version() block for every schema change.
    this.version(1).stores({
      workspaces: "id, updatedAt",
      pages: "id, workspaceId, updatedAt",
      assets: "path, workspaceId",
      kv: "key",
    });
  }
}

let instance: AppDB | null = null;

export function getDB(): AppDB {
  instance ??= new AppDB();
  return instance;
}

/** Tests only: use a fresh, isolated database. */
export function setDBForTests(db: AppDB | null) {
  instance = db;
}
