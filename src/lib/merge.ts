import { diff3Merge, diffComm } from "node-diff3";

/**
 * Line-based three-way merge for page files (front matter + Markdown).
 * Edits in different parts of a page merge cleanly; edits to the same lines are a conflict, which
 * the caller must surface instead of choosing a side. Nothing is ever dropped silently.
 */

export type MergeResult = { clean: true; text: string } | { clean: false; conflicts: number };

const lines = (s: string) => s.split("\n");

export function mergeText(base: string, mine: string, theirs: string): MergeResult {
  if (mine === theirs) return { clean: true, text: mine };
  if (mine === base) return { clean: true, text: theirs };
  if (theirs === base) return { clean: true, text: mine };

  const regions = diff3Merge(lines(mine), lines(base), lines(theirs), { excludeFalseConflicts: true });
  const out: string[] = [];
  let conflicts = 0;
  for (const region of regions) {
    if (region.ok) out.push(...region.ok);
    else conflicts++;
  }
  return conflicts ? { clean: false, conflicts } : { clean: true, text: out.join("\n") };
}

export interface DiffBlock {
  kind: "same" | "mine" | "theirs";
  lines: string[];
}

/** Side-by-side friendly line diff between my version and theirs (for the compare view). */
export function lineDiff(mine: string, theirs: string): DiffBlock[] {
  const blocks: DiffBlock[] = [];
  const push = (kind: DiffBlock["kind"], ls: string[]) => {
    if (!ls.length) return;
    const last = blocks.at(-1);
    if (last?.kind === kind) last.lines.push(...ls);
    else blocks.push({ kind, lines: [...ls] });
  };
  for (const part of diffComm(lines(mine), lines(theirs))) {
    if (part.common) push("same", part.common);
    else {
      push("mine", part.buffer1 ?? []);
      push("theirs", part.buffer2 ?? []);
    }
  }
  return blocks;
}
