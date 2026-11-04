import { describe, expect, it } from "vitest";
import { ancestorsOf, buildTree, computeKeyboardMove, computeMove, descendantIds, flattenVisible, type TreeItem } from "./tree";

const items: TreeItem[] = [
  { id: "A", parentId: null, order: 1 },
  { id: "B", parentId: null, order: 2 },
  { id: "C", parentId: null, order: 3 },
  { id: "A1", parentId: "A", order: 1 },
  { id: "A2", parentId: "A", order: 2 },
  { id: "A1x", parentId: "A1", order: 1 },
];

describe("page tree", () => {
  it("builds a sorted forest with depth", () => {
    const forest = buildTree(items);
    expect(forest.map((n) => n.item.id)).toEqual(["A", "B", "C"]);
    expect(forest[0].children.map((n) => [n.item.id, n.depth])).toEqual([["A1", 1], ["A2", 1]]);
  });

  it("treats pages with a missing parent as roots", () => {
    const forest = buildTree([{ id: "X", parentId: "gone", order: 1 }]);
    expect(forest[0].item.id).toBe("X");
  });

  it("flattens only expanded branches", () => {
    const flat = flattenVisible(buildTree(items), new Set(["A"]));
    expect(flat.map((n) => n.item.id)).toEqual(["A", "A1", "A2", "B", "C"]);
  });

  it("finds descendants and ancestors", () => {
    expect([...descendantIds(items, "A")].sort()).toEqual(["A1", "A1x", "A2"]);
    expect(ancestorsOf(items, "A1x").map((i) => i.id)).toEqual(["A", "A1"]);
  });

  it("moves between siblings using a midpoint order", () => {
    expect(computeMove(items, "C", "B", "before")).toEqual({ parentId: null, order: 1.5 });
    expect(computeMove(items, "A", "C", "after")).toEqual({ parentId: null, order: 4 });
    expect(computeMove(items, "C", "A", "before")).toEqual({ parentId: null, order: 0 });
  });

  it("nests inside a page as its last child", () => {
    expect(computeMove(items, "C", "A", "inside")).toEqual({ parentId: "A", order: 3 });
    expect(computeMove(items, "B", "C", "inside")).toEqual({ parentId: "C", order: 1 });
  });

  it("refuses to move a page into itself or its own subtree", () => {
    expect(computeMove(items, "A", "A", "inside")).toBeNull();
    expect(computeMove(items, "A", "A1x", "inside")).toBeNull();
    expect(computeMove(items, "A", "A2", "after")).toBeNull();
  });

  it("supports keyboard moves", () => {
    expect(computeKeyboardMove(items, "B", "up")).toEqual({ parentId: null, order: 0 });
    expect(computeKeyboardMove(items, "B", "indent")).toEqual({ parentId: "A", order: 3 });
    expect(computeKeyboardMove(items, "A1", "outdent")).toEqual({ parentId: null, order: 1.5 });
    expect(computeKeyboardMove(items, "A", "up")).toBeNull();
    expect(computeKeyboardMove(items, "A", "indent")).toBeNull();
  });
});
