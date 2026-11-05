import type { DatabaseData } from "./types";

/**
 * Three-way merge of database contents by item and field, not by line:
 *  - properties, views and rows merge by id, field by field (so two people editing different
 *    cells of the same row, or adding rows at the same time, never conflict);
 *  - lists of ids (multi-select values, relations, hidden columns) merge as sets;
 *  - an edit beats a delete, so no text is lost;
 *  - the same field changed differently on both sides is a conflict.
 */

export type DbMergeResult = { clean: true; data: DatabaseData } | { clean: false; conflicts: number };

const CONFLICT = Symbol("conflict");
type Merged = unknown | typeof CONFLICT;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const hasIds = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.length > 0 && v.every((x) => isObj(x) && typeof x.id === "string");

function mergeSet(base: string[], mine: string[], theirs: string[]): string[] {
  const removed = new Set([...base.filter((x) => !mine.includes(x)), ...base.filter((x) => !theirs.includes(x))]);
  const out: string[] = [];
  for (const x of [...mine, ...theirs]) if (!removed.has(x) && !out.includes(x)) out.push(x);
  return out;
}

function mergeValue(base: unknown, mine: unknown, theirs: unknown, counter: { n: number }): Merged {
  if (same(mine, theirs)) return mine;
  if (same(mine, base)) return theirs;
  if (same(theirs, base)) return mine;
  const bothLists = (isStrList(mine) || mine === undefined) && (isStrList(theirs) || theirs === undefined) && (isStrList(base) || base === undefined);
  if (bothLists && (mine !== undefined || theirs !== undefined)) return mergeSet((base as string[]) ?? [], (mine as string[]) ?? [], (theirs as string[]) ?? []);
  if ((hasIds(mine) || hasIds(theirs)) && Array.isArray(mine ?? []) && Array.isArray(theirs ?? [])) {
    return mergeById((base as { id: string }[]) ?? [], (mine as { id: string }[]) ?? [], (theirs as { id: string }[]) ?? [], counter);
  }
  if (isObj(mine) && isObj(theirs)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(b)])) {
      const v = mergeValue(b[key], mine[key], theirs[key], counter);
      if (v === CONFLICT) return CONFLICT;
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  counter.n++;
  return CONFLICT;
}

function mergeById<T extends { id: string }>(base: T[], mine: T[], theirs: T[], counter: { n: number }): T[] | typeof CONFLICT {
  const b = new Map(base.map((x) => [x.id, x]));
  const m = new Map(mine.map((x) => [x.id, x]));
  const t = new Map(theirs.map((x) => [x.id, x]));
  // Keep my order, then append items only they have, in their order.
  const ids = [...mine.map((x) => x.id), ...theirs.map((x) => x.id).filter((id) => !m.has(id))];
  for (const id of b.keys()) if (!ids.includes(id) && (m.has(id) || t.has(id))) ids.push(id);
  const out: T[] = [];
  let conflict = false;
  for (const id of ids) {
    const bv = b.get(id);
    const mv = m.get(id);
    const tv = t.get(id);
    if (!mv && !tv) continue;
    if (!bv) {
      // Added on one side (or both, identically).
      if (mv && tv && !same(mv, tv)) {
        const v = mergeValue({}, mv, tv, counter);
        if (v === CONFLICT) conflict = true;
        else out.push(v as T);
      } else out.push((mv ?? tv)!);
      continue;
    }
    if (!mv || !tv) {
      // Deleted on one side: gone if the other side left it alone; an edit beats a delete.
      const kept = (mv ?? tv)!;
      if (!same(kept, bv)) out.push(kept);
      continue;
    }
    const v = mergeValue(bv, mv, tv, counter);
    if (v === CONFLICT) conflict = true;
    else out.push(v as T);
  }
  return conflict ? CONFLICT : out;
}

export function mergeDatabase(base: DatabaseData, mine: DatabaseData, theirs: DatabaseData): DbMergeResult {
  const counter = { n: 0 };
  const properties = mergeById(base.properties, mine.properties, theirs.properties, counter);
  const views = mergeById(base.views, mine.views, theirs.views, counter);
  const rows = mergeById(base.rows, mine.rows, theirs.rows, counter);
  if (properties === CONFLICT || views === CONFLICT || rows === CONFLICT) return { clean: false, conflicts: Math.max(1, counter.n) };
  return { clean: true, data: { properties, views, rows } };
}
