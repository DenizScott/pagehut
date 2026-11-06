import { CONFLICT, mergeStructured } from "@/lib/structured-merge";
import type { DatabaseData } from "./types";

/**
 * Three-way merge of database contents by item and field (see structured-merge.ts):
 * two people editing different cells of the same row, or adding rows at the same time, never
 * conflict; multi-select values and relations merge as sets; an edit beats a delete; the same
 * cell changed differently on both sides is a conflict.
 */

export type DbMergeResult = { clean: true; data: DatabaseData } | { clean: false; conflicts: number };

export function mergeDatabase(base: DatabaseData, mine: DatabaseData, theirs: DatabaseData): DbMergeResult {
  const { value, conflicts } = mergeStructured(base, mine, theirs);
  return value === CONFLICT ? { clean: false, conflicts } : { clean: true, data: value };
}
