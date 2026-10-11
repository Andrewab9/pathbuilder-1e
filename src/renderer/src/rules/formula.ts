// Valutatore minimale delle formule usate dalle "changes" del sistema Foundry PF1,
// es. "2 + if(gte(@skills.per.rank, 10), 2)" o "max(3, @attributes.hd.total)".
// Supporta + - * / %, parentesi, confronti, @riferimenti e le funzioni più comuni.

type Ctx = (path: string) => number | undefined;

const FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  trunc: Math.trunc,
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
  if: (c, a, b = 0) => (c ? a : b),
  ifelse: (c, a, b = 0) => (c ? a : b),
  gte: (a, b) => Number(a >= b),
  gt: (a, b) => Number(a > b),
  lte: (a, b) => Number(a <= b),
  lt: (a, b) => Number(a < b),
  eq: (a, b) => Number(a === b),
  ne: (a, b) => Number(a !== b),
  and: (...a) => Number(a.every(Boolean)),
  or: (...a) => Number(a.some(Boolean)),
  not: (a) => Number(!a),
  sign: Math.sign,
};

class Parser {
  private i = 0;
  constructor(private s: string, private ctx: Ctx) {}

  parse(): number {
    const v = this.expr();
    this.ws();
    if (this.i < this.s.length) throw new Error(`Token inatteso in "${this.s}" @${this.i}`);
    return v;
  }
  private ws() {
    while (this.s[this.i] === ' ') this.i++;
  }
  private expr(): number {
    let v = this.term();
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      if (c === '+') { this.i++; v += this.term(); }
      else if (c === '-') { this.i++; v -= this.term(); }
      else return v;
    }
  }
  private term(): number {
    let v = this.factor();
    for (;;) {
      this.ws();
      const c = this.s[this.i];
      if (c === '*') { this.i++; v *= this.factor(); }
      else if (c === '/') { this.i++; v /= this.factor(); }
      else if (c === '%') { this.i++; v %= this.factor(); }
      else return v;
    }
  }
  private factor(): number {
    this.ws();
    const c = this.s[this.i];
    if (c === '-') { this.i++; return -this.factor(); }
    if (c === '+') { this.i++; return this.factor(); }
    if (c === '(') {
      this.i++;
      const v = this.expr();
      this.expect(')');
      return v;
    }
    if (c === '@') {
      const m = /^@[\w.]+/.exec(this.s.slice(this.i))!;
      this.i += m[0].length;
      return this.ctx(m[0].slice(1)) ?? 0;
    }
    const num = /^\d+(\.\d+)?/.exec(this.s.slice(this.i));
    if (num) { this.i += num[0].length; return parseFloat(num[0]); }
    const id = /^[a-zA-Z_]\w*/.exec(this.s.slice(this.i));
    if (id) {
      this.i += id[0].length;
      const name = id[0].toLowerCase();
      if (name === 'true') return 1;
      if (name === 'false') return 0;
      this.ws();
      this.expect('(');
      const args: number[] = [];
      this.ws();
      if (this.s[this.i] !== ')') {
        for (;;) {
          args.push(this.expr());
          this.ws();
          if (this.s[this.i] === ',') { this.i++; continue; }
          break;
        }
      }
      this.expect(')');
      const fn = FUNCS[name];
      if (!fn) throw new Error(`Funzione sconosciuta ${name}`);
      return fn(...args);
    }
    throw new Error(`Formula non valida "${this.s}" @${this.i}`);
  }
  private expect(ch: string) {
    this.ws();
    if (this.s[this.i] !== ch) throw new Error(`Atteso "${ch}" in "${this.s}"`);
    this.i++;
  }
}

/** Valuta una formula; restituisce null se non è supportata (es. contiene tiri di dado). */
export function evalFormula(formula: string, ctx: Ctx): number | null {
  const f = String(formula).trim();
  if (/^-?\d+$/.test(f)) return parseInt(f, 10);
  if (/\d+d\d+/.test(f)) return null;
  try {
    const v = new Parser(f, ctx).parse();
    return Number.isFinite(v) ? Math.trunc(v) : null;
  } catch {
    return null;
  }
}
