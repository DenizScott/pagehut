/**
 * Formulas for balance tables: arithmetic over number properties, written with property names in
 * braces, e.g. `{Damage} * {Hits per second}` or `round({Cost} / max({Level}, 1), 2)`.
 *
 * Supported: numbers, + - * / %, parentheses, unary minus, and min, max, round, floor, ceil, abs.
 * Parsed by hand (no eval). Empty references count as 0; anything invalid gives an error.
 */

export class FormulaError extends Error {}

type Token = { t: "num"; v: number } | { t: "ref"; v: string } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new FormulaError(`Bad number at ${i}`);
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
    } else if (c === "{") {
      const end = src.indexOf("}", i);
      if (end < 0) throw new FormulaError("Missing }");
      out.push({ t: "ref", v: src.slice(i + 1, end).trim() });
      i = end + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0].toLowerCase() });
      i += m[0].length;
    } else if ("+-*/%(),".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else {
      throw new FormulaError(`Unexpected "${c}"`);
    }
  }
  return out;
}

const functions: Record<string, (args: number[]) => number> = {
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
  abs: ([x]) => Math.abs(x),
  floor: ([x]) => Math.floor(x),
  ceil: ([x]) => Math.ceil(x),
  round: ([x, digits = 0]) => {
    const f = 10 ** digits;
    return Math.round(x * f) / f;
  },
};

/** Evaluates a formula. `lookup` returns the number for a property name (case-insensitive). */
export function evaluateFormula(src: string, lookup: (name: string) => number | undefined): number {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const expect = (v: string) => {
    if (!isOp(v)) throw new FormulaError(`Expected "${v}"`);
    pos++;
  };

  const primary = (): number => {
    const tok = peek();
    if (!tok) throw new FormulaError("Unexpected end");
    if (tok.t === "num") {
      pos++;
      return tok.v;
    }
    if (tok.t === "ref") {
      pos++;
      const v = lookup(tok.v);
      if (v === undefined) throw new FormulaError(`Unknown property {${tok.v}}`);
      return v;
    }
    if (tok.t === "id") {
      pos++;
      const fn = functions[tok.v];
      if (!fn) throw new FormulaError(`Unknown function ${tok.v}`);
      expect("(");
      const args = [expr()];
      while (isOp(",")) {
        pos++;
        args.push(expr());
      }
      expect(")");
      return fn(args);
    }
    if (isOp("(")) {
      pos++;
      const v = expr();
      expect(")");
      return v;
    }
    if (isOp("-")) {
      pos++;
      return -primary();
    }
    if (isOp("+")) {
      pos++;
      return primary();
    }
    throw new FormulaError(`Unexpected "${tok.v}"`);
  };
  const term = (): number => {
    let v = primary();
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = tokens[pos++].v;
      const r = primary();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos++].v;
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };

  if (!tokens.length) throw new FormulaError("Empty formula");
  const value = expr();
  if (pos < tokens.length) throw new FormulaError(`Unexpected "${tokens[pos].v}"`);
  return value;
}
