import { z } from "zod";
import type { DatabaseData } from "@/lib/database/types";

/**
 * On-disk formats (what ends up in the GitHub repo) and local records.
 * Bump SCHEMA_VERSION and add a migration in src/lib/storage/db.ts when a stored shape changes.
 */
export const SCHEMA_VERSION = 1;

export const idSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "ULID expected");

/** YAML frontmatter of pages/<id>.md */
export const pageFrontmatterSchema = z.object({
  id: idSchema,
  title: z.string().max(500),
  icon: z.string().max(16).optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type PageFrontmatter = z.infer<typeof pageFrontmatterSchema>;

/** One entry of the page tree in workspace.json */
export const treeNodeSchema = z.object({
  id: idSchema,
  parentId: idSchema.nullable(),
  /** Sort key among siblings; fractional so moves touch only one node. */
  order: z.number(),
  title: z.string(),
  icon: z.string().optional(),
  /** "database" for database pages (P4); absent for documents. */
  kind: z.enum(["database"]).optional(),
  deletedAt: z.number().optional(),
});
export type TreeNode = z.infer<typeof treeNodeSchema>;

export const pillarSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string().optional(),
});
export type Pillar = z.infer<typeof pillarSchema>;

/** workspace.json at the repo root */
export const workspaceFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  name: z.string(),
  locale: z.string().optional(),
  tree: z.array(treeNodeSchema),
  pillars: z.array(pillarSchema).default([]),
  templates: z.array(z.object({ id: idSchema, title: z.string(), pageId: idSchema })).default([]),
});
export type WorkspaceFile = z.infer<typeof workspaceFileSchema>;

export type PageKind = "database";

/* ---------- Local (IndexedDB) records ---------- */

export type StorageMode = "local" | "github";

export interface WorkspaceRecord {
  id: string;
  name: string;
  mode: StorageMode;
  createdAt: number;
  updatedAt: number;
  /** Design pillars shown above every page. */
  pillars?: Pillar[];
  /** github mode only: the repository this workspace lives in. */
  repo?: { owner: string; name: string; branch: string; /** folder in the repo, "" = root */ dir?: string };
  /** github mode: commit the local copy was last synced with (null = repo was empty). */
  headSha?: string | null;
  /** github mode: workspace.json text as last synced, to detect tree/pillar changes. */
  workspaceFileBase?: string;
  /** github mode: blob sha of workspace.json as last synced. */
  workspaceFileSha?: string;
  /** github mode: some remote changes were postponed (page being edited); pull again next time. */
  pullDeferred?: boolean;
  lastSyncedAt?: number;
}

/** Last synced remote state of a page; the base of a three-way merge (P3). */
export interface SyncBase {
  /** Full file text of pages/<id>.md (front matter + body) as last synced. */
  markdown: string;
  sha: string;
  syncedAt: number;
}

export interface PageRecord {
  id: string;
  workspaceId: string;
  parentId: string | null;
  order: number;
  title: string;
  icon?: string;
  /** "database" for database pages (P4); absent for documents. */
  kind?: PageKind;
  /** Database pages: working copy of properties, views and rows. `markdown` is its file body. */
  database?: DatabaseData;
  /** Working copy: ProseMirror JSON. Lossless for anything the editor can express. */
  doc: unknown;
  /** Canonical file body, regenerated from `doc` on every save. This is what gets committed. */
  markdown: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  /** true when the page changed since `base` (always true in local mode). */
  dirty: boolean;
  base?: SyncBase;
  /**
   * Set when the page changed both here and on GitHub in the same lines. The local text stays
   * as it is; the remote version waits here until the user chooses (keep mine / keep theirs).
   */
  conflict?: { remoteText: string; remoteSha: string; detectedAt: number };
}

export interface AssetRecord {
  /** Repo-relative path, e.g. "assets/1a2b3c4d-concept.png". */
  path: string;
  workspaceId: string;
  blob: Blob;
  mime: string;
  size: number;
  createdAt: number;
  /** Blob sha once uploaded to the workspace repo. */
  sha?: string;
}

export const ASSET_WARN_BYTES = 1024 * 1024;
export const ASSET_MAX_BYTES = 25 * 1024 * 1024;
