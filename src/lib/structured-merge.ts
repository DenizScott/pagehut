/**
 * Three-way merge of JSON-like data by item and field, not by line (databases, comments):
 *  - objects merge key by key;
 *  - arrays of objects with an `id` merge by id (my order first, then items only they have);
 *  - arrays of strings merge as sets;
 *  - an item deleted on one side and edited on the other is kept (an edit beats a delete);
 *  - anything else changed differently on both sides is a conflict, unless `resolve` decides.
 */

export const CONFLICT = Symbol("conflict");
export type Merged<T> = T | typeof CONFLICT;

/** Decides a field changed differently on both sides; return CONFLICT to give up. */
export type Resolver = (base: unknown, mine: unknown, theirs: unknown, path: string[]) => unknown;

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

interface Ctx {
  conflicts: number;
  resolve?: Resolver;
}

function mergeValue(base: unknown, mine: unknown, theirs: unknown, ctx: Ctx, path: string[]): unknown {
  if (same(mine, theirs)) return mine;
  if (same(mine, base)) return theirs;
  if (same(theirs, base)) return mine;
  const lists = [base, mine, theirs].every((v) => v === undefined || isStrList(v));
  if (lists && (mine !== undefined || theirs !== undefined)) return mergeSet((base as string[]) ?? [], (mine as string[]) ?? [], (theirs as string[]) ?? []);
  if ((hasIds(mine) || hasIds(theirs)) && Array.isArray(mine ?? []) && Array.isArray(theirs ?? [])) {
    return mergeById((base as { id: string }[]) ?? [], (mine as { id: string }[]) ?? [], (theirs as { id: string }[]) ?? [], ctx, path);
  }
  if (isObj(mine) && isObj(theirs)) {
    const b = isObj(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(b)])) {
      const v = mergeValue(b[key], mine[key], theirs[key], ctx, [...path, key]);
      if (v === CONFLICT) return CONFLICT;
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  const decided = ctx.resolve ? ctx.resolve(base, mine, theirs, path) : CONFLICT;
  if (decided === CONFLICT) ctx.conflicts++;
  return decided;
}

function mergeById<T extends { id: string }>(base: T[], mine: T[], theirs: T[], ctx: Ctx, path: string[]): T[] | typeof CONFLICT {
  const b = new Map(base.map((x) => [x.id, x]));
  const m = new Map(mine.map((x) => [x.id, x]));
  const t = new Map(theirs.map((x) => [x.id, x]));
  const ids = [...mine.map((x) => x.id), ...theirs.map((x) => x.id).filter((id) => !m.has(id))];
  const out: T[] = [];
  let conflict = false;
  for (const id of ids) {
    const bv = b.get(id);
    const mv = m.get(id);
    const tv = t.get(id);
    if (!bv) {
      if (mv && tv && !same(mv, tv)) {
        const v = mergeValue({}, mv, tv, ctx, [...path, id]);
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
    const v = mergeValue(bv, mv, tv, ctx, [...path, id]);
    if (v === CONFLICT) conflict = true;
    else out.push(v as T);
  }
  return conflict ? CONFLICT : out;
}

/** Merges two edits of the same data. Returns CONFLICT (and how many) when it can't. */
export function mergeStructured<T>(base: T, mine: T, theirs: T, resolve?: Resolver): { value: Merged<T>; conflicts: number } {
  const ctx: Ctx = { conflicts: 0, resolve };
  const value = mergeValue(base, mine, theirs, ctx, []) as Merged<T>;
  return { value, conflicts: value === CONFLICT ? Math.max(1, ctx.conflicts) : 0 };
}
