/**
 * Pure page-tree helpers. Pages are a flat list with `parentId` + fractional `order`, so a move
 * changes exactly one record (no renumbering of siblings, fewer merge conflicts once synced).
 */

export interface TreeItem {
  id: string;
  parentId: string | null;
  order: number;
}

export interface TreeNode<T extends TreeItem> {
  item: T;
  depth: number;
  children: TreeNode<T>[];
}

export type DropPosition = "before" | "after" | "inside";

const byOrder = <T extends TreeItem>(a: T, b: T) => a.order - b.order || a.id.localeCompare(b.id);

/** Builds a sorted forest. Items whose parent is missing (e.g. trashed) become roots. */
export function buildTree<T extends TreeItem>(items: T[]): TreeNode<T>[] {
  const ids = new Set(items.map((i) => i.id));
  const childrenOf = new Map<string | null, T[]>();
  for (const item of items) {
    const parent = item.parentId && ids.has(item.parentId) ? item.parentId : null;
    const list = childrenOf.get(parent) ?? [];
    list.push(item);
    childrenOf.set(parent, list);
  }
  const build = (parent: string | null, depth: number): TreeNode<T>[] =>
    (childrenOf.get(parent) ?? []).sort(byOrder).map((item) => ({ item, depth, children: build(item.id, depth + 1) }));
  return build(null, 0);
}

/** Depth-first list of visible nodes, skipping children of collapsed nodes. */
export function flattenVisible<T extends TreeItem>(forest: TreeNode<T>[], expanded: ReadonlySet<string>): TreeNode<T>[] {
  const out: TreeNode<T>[] = [];
  const walk = (nodes: TreeNode<T>[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children.length && expanded.has(n.item.id)) walk(n.children);
    }
  };
  walk(forest);
  return out;
}

export function descendantIds<T extends TreeItem>(items: T[], id: string): Set<string> {
  const result = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const current = queue.pop()!;
    for (const item of items) {
      if (item.parentId === current && !result.has(item.id)) {
        result.add(item.id);
        queue.push(item.id);
      }
    }
  }
  return result;
}

/** Ancestors from the root down to the direct parent. Stops on cycles. */
export function ancestorsOf<T extends TreeItem>(items: T[], id: string): T[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const chain: T[] = [];
  const seen = new Set<string>([id]);
  let parentId = byId.get(id)?.parentId ?? null;
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    chain.unshift(parent);
    seen.add(parentId);
    parentId = parent.parentId;
  }
  return chain;
}

/**
 * Where `dragId` ends up when dropped relative to `targetId`.
 * Returns null for no-op or invalid moves (onto itself, or into its own subtree).
 */
export function computeMove<T extends TreeItem>(
  items: T[],
  dragId: string,
  targetId: string,
  position: DropPosition,
): { parentId: string | null; order: number } | null {
  if (dragId === targetId) return null;
  const target = items.find((i) => i.id === targetId);
  if (!target || descendantIds(items, dragId).has(targetId)) return null;

  const parentId = position === "inside" ? target.id : target.parentId;
  const siblings = items.filter((i) => i.parentId === parentId && i.id !== dragId).sort(byOrder);

  if (position === "inside") {
    const last = siblings.at(-1);
    return { parentId, order: last ? last.order + 1 : 1 };
  }

  const index = siblings.findIndex((s) => s.id === targetId);
  const neighbour = position === "before" ? siblings[index - 1] : siblings[index + 1];
  const order = neighbour
    ? (target.order + neighbour.order) / 2
    : position === "before"
      ? target.order - 1
      : target.order + 1;
  return { parentId, order };
}

/** Keyboard moves (accessible alternative to drag and drop). */
export function computeKeyboardMove<T extends TreeItem>(
  items: T[],
  id: string,
  action: "up" | "down" | "indent" | "outdent",
): { parentId: string | null; order: number } | null {
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  const siblings = items.filter((i) => i.parentId === item.parentId).sort(byOrder);
  const index = siblings.findIndex((s) => s.id === id);

  switch (action) {
    case "up":
      return index > 0 ? computeMove(items, id, siblings[index - 1].id, "before") : null;
    case "down":
      return index < siblings.length - 1 ? computeMove(items, id, siblings[index + 1].id, "after") : null;
    case "indent":
      return index > 0 ? computeMove(items, id, siblings[index - 1].id, "inside") : null;
    case "outdent":
      return item.parentId ? computeMove(items, id, item.parentId, "after") : null;
  }
}
