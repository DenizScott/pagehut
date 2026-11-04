import { z } from "zod";

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
  deletedAt: z.number().optional(),
});
export type TreeNode = z.infer<typeof treeNodeSchema>;

export const pillarSchema = z.object({
  id: idSchema,
  title: z.string(),
  description: z.string().optional(),
});

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

/* ---------- Local (IndexedDB) records ---------- */

export type StorageMode = "local" | "github";

export interface WorkspaceRecord {
  id: string;
  name: string;
  mode: StorageMode;
  createdAt: number;
  updatedAt: number;
  /** github mode only (P2) */
  repo?: { owner: string; name: string; branch: string };
}

/** Last synced remote state of a page; the base of a three-way merge (P3). */
export interface SyncBase {
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
}

export interface AssetRecord {
  /** Repo-relative path, e.g. "assets/1a2b3c4d-concept.png". */
  path: string;
  workspaceId: string;
  blob: Blob;
  mime: string;
  size: number;
  createdAt: number;
}

export const ASSET_WARN_BYTES = 1024 * 1024;
export const ASSET_MAX_BYTES = 25 * 1024 * 1024;
