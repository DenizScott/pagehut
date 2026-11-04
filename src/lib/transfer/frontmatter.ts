/**
 * Minimal YAML front matter for pages/<id>.md. We write a strict subset (strings as JSON, which is
 * valid YAML) and read leniently, so files from other tools still import.
 */

export type FrontMatter = Record<string, string | string[] | number | boolean>;

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function stringifyFrontMatter(meta: FrontMatter): string {
  const lines = Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return lines.length ? `---\n${lines.join("\n")}\n---\n\n` : "";
}

function parseValue(raw: string): FrontMatter[string] {
  const v = raw.trim();
  if (/^["[]/.test(v) || v === "true" || v === "false" || /^-?\d+(\.\d+)?$/.test(v)) {
    try {
      return JSON.parse(v) as FrontMatter[string];
    } catch {
      /* fall through to plain string */
    }
  }
  return v.replace(/^'(.*)'$/, "$1");
}

export function parseFrontMatter(text: string): { meta: FrontMatter; body: string } {
  const match = FM_RE.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta: FrontMatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m && m[2] !== "") meta[m[1]] = parseValue(m[2]);
  }
  return { meta, body: text.slice(match[0].length).replace(/^\s*\n/, "") };
}
