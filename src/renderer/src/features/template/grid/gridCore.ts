export interface CellInfo {
  r: number
  c: number
  rs: number
  cs: number
  def: number | null
  end: number | null
}

export interface GridInfo {
  head: number
  close: number
  cols: number
  widths: (number | null)[]
  heights: number[]
  cells: CellInfo[]
}

export interface Rect {
  r1: number
  c1: number
  r2: number
  c2: number
}

export type GridResult =
  { ok: true; from: number; to: number; lines: string[] } | { ok: false; error: string }

export type GetLine = (n: number) => string

const PAPER_MM = 186
const MIN_MM = 1
export const MAX_MM = 280
export const MAX_COLS = 100
export const MAX_ROWS = 200
export const NEW_KEY = Number.MAX_SAFE_INTEGER

export const r2 = (n: number): number => Math.round(n * 100) / 100
const fmt = (n: number): string => String(r2(n))
export const fail = (error: string): GridResult => ({ ok: false, error })
export const sum = (a: number[], from: number, len: number): number =>
  a.slice(from, from + len).reduce((x, y) => x + y, 0)

export function tokenize(src: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (const ch of src) {
    if (ch === '"') {
      q = !q
      cur += ch
    } else if (!q && /\s/.test(ch)) {
      if (cur !== '') out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur !== '') out.push(cur)
  return out
}

function splitColon(src: string): [string, string | null] {
  let q = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') q = !q
    else if (ch === ':' && !q) return [src.slice(0, i), src.slice(i + 1)]
  }
  return [src, null]
}

export interface DefParts {
  indent: string
  head: string[]
  tail: string[] | null
}

const isPos = (t: string): boolean => /^(?:col|row)=/.test(t)
const isH = (t: string): boolean => /^h=/.test(t)

export function parseDef(line: string): DefParts {
  const indent = /^\s*/.exec(line)?.[0] ?? ''
  const [h, t] = splitColon(line.slice(indent.length))
  return { indent, head: tokenize(h), tail: t === null ? null : tokenize(t) }
}

export function hOf(p: DefParts): number | null {
  for (const tok of [...p.head, ...(p.tail ?? [])]) {
    const m = /^h=(.+)$/.exec(tok)
    if (m) {
      const n = Number(m[1])
      if (Number.isFinite(n)) return n
    }
  }
  return null
}

function buildDef(
  p: DefParts,
  r: number,
  c: number,
  rs: number,
  cs: number,
  h: number | null | undefined
): string {
  const strip = (a: string[]): string[] => (h === undefined ? a : a.filter((t) => !isH(t)))
  const rest = strip(p.head.filter((t) => !isPos(t)))
  const tail = p.tail === null ? null : strip(p.tail)
  const pos = [
    `col=${c + 1}${cs > 1 ? `-${c + cs}` : ''}`,
    `row=${r + 1}${rs > 1 ? `-${r + rs}` : ''}`
  ]
  const hTok = typeof h === 'number' ? [`h=${fmt(h)}`] : []
  const left = [...pos, ...rest, ...hTok].join(' ')
  if (tail === null) return p.indent + left
  return p.indent + left + ' :' + (tail.length > 0 ? ' ' + tail.join(' ') : '')
}

export function bodyOf(c: CellInfo, getLine: GetLine): string[] {
  if (c.def === null || c.end === null) return []
  const out: string[] = []
  for (let n = c.def + 1; n <= c.end; n++) out.push(getLine(n))
  return out
}

export function effectiveWidths(widths: (number | null)[], cols: number): number[] {
  const free = widths.filter((w) => w === null).length
  if (free === widths.length) return Array<number>(cols).fill(PAPER_MM / cols)
  const fixed = widths.reduce<number>((a, w) => a + (w ?? 0), 0)
  const share = free > 0 ? Math.max(0, PAPER_MM - fixed) / free : 0
  return widths.map((w) => w ?? share)
}

export function demand(span: number, k: number): number[] {
  if (k <= span) return Array<number>(span).fill(1)
  const extra = k - span
  const base = Math.floor(extra / span)
  const rem = extra % span
  return Array.from({ length: span }, (_, i) => 1 + base + (i < rem ? 1 : 0))
}

export function partition(total: number, k: number): number[] {
  const base = Math.floor(total / k)
  const rem = total % k
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0))
}

export function starts(n: number[]): number[] {
  const s: number[] = []
  let a = 0
  for (const x of n) {
    s.push(a)
    a += x
  }
  return s
}

export function splitSizes(vals: number[], ns: number[]): number[] | null {
  const raw: number[] = []
  vals.forEach((v, i) => {
    for (let k = 0; k < ns[i]; k++) raw.push(v / ns[i])
  })
  const total = r2(vals.reduce((a, b) => a + b, 0))
  const out = raw.map(r2)
  const diff = r2(total - out.reduce((a, b) => a + b, 0))
  if (diff !== 0) {
    let m = 0
    out.forEach((v, i) => {
      if (v > out[m]) m = i
    })
    out[m] = r2(out[m] + diff)
  }
  return out.every((v) => v >= MIN_MM) ? out : null
}

export function cellsIn(info: GridInfo, rect: Rect): CellInfo[] | string {
  const out: CellInfo[] = []
  for (const c of info.cells) {
    const hit = c.r + c.rs > rect.r1 && c.r <= rect.r2 && c.c + c.cs > rect.c1 && c.c <= rect.c2
    if (!hit) continue
    const inside =
      c.r >= rect.r1 && c.r + c.rs - 1 <= rect.r2 && c.c >= rect.c1 && c.c + c.cs - 1 <= rect.c2
    if (!inside) return '선택한 범위가 칸 경계와 맞지 않아요.'
    out.push(c)
  }
  return out.length === 0 ? '선택한 칸이 없어요.' : out
}

export interface Out {
  key: number
  seq: number
  r: number
  c: number
  rs: number
  cs: number
  parts: DefParts
  body: string[]
  h?: number | null
}

function header(line: string, cols: { n: number; widths: number[] | null } | null): string {
  if (!cols) return line
  const indent = /^\s*/.exec(line)?.[0] ?? ''
  const body = line.trim().replace(/\[$/, '').trim()
  const toks = tokenize(body)
    .filter((t) => !/^widths=/.test(t))
    .map((t) => (/^grid=\d+$/.test(t) ? `grid=${cols.n}` : t))
  if (cols.widths) toks.push(`widths=${cols.widths.map(fmt).join(',')}`)
  return `${indent}${toks.join(' ')} [`
}

export function assemble(
  info: GridInfo,
  getLine: GetLine,
  items: Out[],
  cols: { n: number; widths: number[] | null } | null
): GridResult {
  items.sort((a, b) => a.key - b.key || a.seq - b.seq)
  const lines: string[] = [header(getLine(info.head), cols)]
  for (const it of items) {
    lines.push(buildDef(it.parts, it.r, it.c, it.rs, it.cs, it.h))
    lines.push(...it.body)
  }
  lines.push(getLine(info.close))
  return { ok: true, from: info.head, to: info.close, lines }
}

export function emptyDef(info: GridInfo, getLine: GetLine): DefParts {
  return { indent: (/^\s*/.exec(getLine(info.head))?.[0] ?? '') + '  ', head: [], tail: [] }
}