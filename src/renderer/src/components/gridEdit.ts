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
  | { ok: true; from: number; to: number; lines: string[] }
  | { ok: false; error: string }

type GetLine = (n: number) => string

const PAPER_MM = 186
const MIN_MM = 1
const MAX_MM = 280
const MAX_COLS = 100
const MAX_ROWS = 200

const r2 = (n: number): number => Math.round(n * 100) / 100
const fmt = (n: number): string => String(r2(n))
const fail = (error: string): GridResult => ({ ok: false, error })
const sum = (a: number[], from: number, len: number): number =>
  a.slice(from, from + len).reduce((x, y) => x + y, 0)

function tokenize(src: string): string[] {
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

interface DefParts {
  indent: string
  head: string[]
  tail: string[] | null
}

const isPos = (t: string): boolean => /^(?:col|row)=/.test(t)
const isH = (t: string): boolean => /^h=/.test(t)

function parseDef(line: string): DefParts {
  const indent = /^\s*/.exec(line)?.[0] ?? ''
  const [h, t] = splitColon(line.slice(indent.length))
  return { indent, head: tokenize(h), tail: t === null ? null : tokenize(t) }
}

function hOf(p: DefParts): number | null {
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

function bodyOf(c: CellInfo, getLine: GetLine): string[] {
  if (c.def === null || c.end === null) return []
  const out: string[] = []
  for (let n = c.def + 1; n <= c.end; n++) out.push(getLine(n))
  return out
}

function effectiveWidths(widths: (number | null)[], cols: number): number[] {
  const free = widths.filter((w) => w === null).length
  if (free === widths.length) return Array<number>(cols).fill(PAPER_MM / cols)
  const fixed = widths.reduce<number>((a, w) => a + (w ?? 0), 0)
  const share = free > 0 ? Math.max(0, PAPER_MM - fixed) / free : 0
  return widths.map((w) => w ?? share)
}

function demand(span: number, k: number): number[] {
  if (k <= span) return Array<number>(span).fill(1)
  const extra = k - span
  const base = Math.floor(extra / span)
  const rem = extra % span
  return Array.from({ length: span }, (_, i) => 1 + base + (i < rem ? 1 : 0))
}

function partition(total: number, k: number): number[] {
  const base = Math.floor(total / k)
  const rem = total % k
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0))
}

function starts(n: number[]): number[] {
  const s: number[] = []
  let a = 0
  for (const x of n) {
    s.push(a)
    a += x
  }
  return s
}

function splitSizes(vals: number[], ns: number[]): number[] | null {
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

function cellsIn(info: GridInfo, rect: Rect): CellInfo[] | string {
  const out: CellInfo[] = []
  for (const c of info.cells) {
    const hit =
      c.r + c.rs > rect.r1 && c.r <= rect.r2 && c.c + c.cs > rect.c1 && c.c <= rect.c2
    if (!hit) continue
    const inside =
      c.r >= rect.r1 &&
      c.r + c.rs - 1 <= rect.r2 &&
      c.c >= rect.c1 &&
      c.c + c.cs - 1 <= rect.c2
    if (!inside) return '선택한 범위가 칸 경계와 맞지 않아요.'
    out.push(c)
  }
  return out.length === 0 ? '선택한 칸이 없어요.' : out
}

interface Out {
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

function assemble(
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

export function mergeGrid(info: GridInfo, rect: Rect, getLine: GetLine): GridResult {
  const inside = cellsIn(info, rect)
  if (typeof inside === 'string') return fail(inside)
  if (inside.length < 2) return fail('합칠 칸을 둘 이상 선택해 주세요.')
  const set = new Set(inside)
  const real = inside
    .filter((c) => c.def !== null)
    .sort((a, b) => a.r - b.r || a.c - b.c)
  const rs = rect.r2 - rect.r1 + 1
  const cs = rect.c2 - rect.c1 + 1
  const gridIndent = (/^\s*/.exec(getLine(info.head))?.[0] ?? '') + '  '
  const parts: DefParts =
    real.length > 0
      ? parseDef(getLine(real[0].def as number))
      : { indent: gridIndent, head: [], tail: [] }

  const bodyIndent = parts.indent + '  '
  const body: string[] = []
  for (const c of real) {
    for (const l of bodyOf(c, getLine)) if (l.trim() !== '') body.push(bodyIndent + l.trim())
  }

  let h: number | null | undefined
  if (rs > 1) {
    h = Math.min(MAX_MM, r2(sum(info.heights, rect.r1, rs)))
  } else {
    const hs = real
      .map((c) => hOf(parseDef(getLine(c.def as number))))
      .filter((v): v is number => v !== null)
    h = hs.length > 0 ? Math.max(...hs) : undefined
  }

  const items: Out[] = []
  for (const cell of info.cells) {
    if (set.has(cell) || cell.def === null) continue
    items.push({
      key: cell.def,
      seq: 0,
      r: cell.r,
      c: cell.c,
      rs: cell.rs,
      cs: cell.cs,
      parts: parseDef(getLine(cell.def)),
      body: bodyOf(cell, getLine)
    })
  }
  items.push({
    key: real.length > 0 ? Math.min(...real.map((c) => c.def as number)) : Number.MAX_SAFE_INTEGER,
    seq: 0,
    r: rect.r1,
    c: rect.c1,
    rs,
    cs,
    parts,
    body,
    h
  })
  return assemble(info, getLine, items, null)
}

function equalColumns(info: GridInfo, inside: CellInfo[], nCols: number): Map<number, number> | null {
  const groups = new Map<number, number>()
  for (const cell of inside) {
    if (nCols <= cell.cs) return null
    const had = groups.get(cell.c)
    if (had !== undefined && had !== cell.cs) return null
    groups.set(cell.c, cell.cs)
  }
  const moved = new Set(inside)
  for (const [c, len] of groups) {
    for (const [c2, len2] of groups) {
      if (c2 !== c && c2 < c + len && c < c2 + len2) return null
    }
    for (const o of info.cells) {
      if (moved.has(o)) continue
      const hit = o.c < c + len && o.c + o.cs > c
      if (hit && !(o.c <= c && o.c + o.cs >= c + len)) return null
    }
  }
  return groups
}

export function splitGrid(
  info: GridInfo,
  rect: Rect,
  nCols: number,
  nRows: number,
  getLine: GetLine
): GridResult {
  if (!Number.isInteger(nCols) || !Number.isInteger(nRows) || nCols < 1 || nRows < 1) {
    return fail('칸 수와 줄 수는 1 이상의 정수예요.')
  }
  if (nCols === 1 && nRows === 1) return fail('나눌 칸 수나 줄 수가 1보다 커야 해요.')
  const inside = cellsIn(info, rect)
  if (typeof inside === 'string') return fail(inside)

  const rows = info.heights.length
  const colN = Array<number>(info.cols).fill(1)
  const rowN = Array<number>(rows).fill(1)
  for (const cell of inside) {
    demand(cell.cs, nCols).forEach((v, i) => {
      colN[cell.c + i] = Math.max(colN[cell.c + i], v)
    })
    demand(cell.rs, nRows).forEach((v, i) => {
      rowN[cell.r + i] = Math.max(rowN[cell.r + i], v)
    })
  }
  const eff = effectiveWidths(info.widths, info.cols)
  const eq = equalColumns(info, inside, nCols)
  const colStart: number[] = []
  const colEnd: number[] = []
  let newW: number[] | null = []
  if (eq) {
    for (let j = 0; j < info.cols; ) {
      const len = eq.get(j)
      if (len !== undefined) {
        const pieces = splitSizes([sum(eff, j, len)], [nCols])
        if (pieces === null) {
          newW = null
          break
        }
        for (let x = j; x < j + len; x++) {
          colStart[x] = newW.length
          colEnd[x] = newW.length + nCols
        }
        newW.push(...pieces)
        j += len
      } else {
        colStart[j] = newW.length
        colEnd[j] = newW.length + 1
        newW.push(eff[j])
        j++
      }
    }
  } else {
    const cStart0 = starts(colN)
    for (let j = 0; j < info.cols; j++) {
      colStart[j] = cStart0[j]
      colEnd[j] = cStart0[j] + colN[j]
    }
    newW = splitSizes(eff, colN)
  }
  if (newW === null) return fail('칸이 너무 좁아져서 더 나눌 수 없어요.')
  const newCols = newW.length
  const newRows = rowN.reduce((a, b) => a + b, 0)
  if (newCols > MAX_COLS) return fail(`열은 ${MAX_COLS}개까지예요.`)
  if (newRows > MAX_ROWS) return fail(`줄은 ${MAX_ROWS}개까지예요.`)
  const addCols = newCols !== info.cols
  const newH = splitSizes(info.heights, rowN)
  if (newH === null) return fail('줄이 너무 낮아져서 더 나눌 수 없어요.')

  const rStart = starts(rowN)
  const moved = new Set(inside)
  const items: Out[] = []
  for (const cell of info.cells) {
    const m = {
      r: rStart[cell.r],
      c: colStart[cell.c],
      rs: sum(rowN, cell.r, cell.rs),
      cs: colEnd[cell.c + cell.cs - 1] - colStart[cell.c]
    }
    if (!moved.has(cell)) {
      if (cell.def !== null) {
        items.push({
          key: cell.def,
          seq: 0,
          ...m,
          parts: parseDef(getLine(cell.def)),
          body: bodyOf(cell, getLine)
        })
      }
      continue
    }
    if (cell.def === null) continue
    const parts = parseDef(getLine(cell.def))
    const cw = partition(m.cs, nCols)
    const rh = partition(m.rs, nRows)
    let seq = 0
    let rr = m.r
    for (let ri = 0; ri < nRows; ri++) {
      let cc = m.c
      for (let ci = 0; ci < nCols; ci++) {
        items.push({
          key: cell.def,
          seq: seq++,
          r: rr,
          c: cc,
          rs: rh[ri],
          cs: cw[ci],
          parts,
          body: ri === 0 && ci === 0 ? bodyOf(cell, getLine) : [],
          h: nRows > 1 ? r2(sum(newH, rr, rh[ri])) : undefined
        })
        cc += cw[ci]
      }
      rr += rh[ri]
    }
  }
  return assemble(info, getLine, items, addCols ? { n: newCols, widths: newW } : null)
}

const NEW_KEY = Number.MAX_SAFE_INTEGER

function emptyDef(info: GridInfo, getLine: GetLine): DefParts {
  return { indent: (/^\s*/.exec(getLine(info.head))?.[0] ?? '') + '  ', head: [], tail: [] }
}

function ensureLastRow(info: GridInfo, getLine: GetLine, items: Out[], rows: number, h: number): void {
  if (items.some((it) => it.r + it.rs === rows)) return
  const used = new Set<number>()
  for (const it of items) {
    if (it.r <= rows - 1 && it.r + it.rs > rows - 1) for (let c = it.c; c < it.c + it.cs; c++) used.add(c)
  }
  let col = 0
  while (used.has(col)) col++
  items.push({ key: NEW_KEY, seq: items.length, r: rows - 1, c: col, rs: 1, cs: 1, parts: emptyDef(info, getLine), body: [], h })
}

function fitWidths(list: number[], total: number): number[] | null {
  const now = list.reduce((a, b) => a + b, 0)
  return splitSizes(list.map((v) => (v * total) / now), list.map(() => 1))
}

export function insertRows(info: GridInfo, rect: Rect, after: boolean, getLine: GetLine): GridResult {
  const n = rect.r2 - rect.r1 + 1
  const rows = info.heights.length
  if (rows + n > MAX_ROWS) return fail(`줄은 ${MAX_ROWS}개까지예요.`)
  const p = after ? rect.r2 + 1 : rect.r1
  const items: Out[] = []
  const straddle: CellInfo[] = []
  for (const cell of info.cells) {
    if (cell.def === null) continue
    const parts = parseDef(getLine(cell.def))
    let r = cell.r
    let rs = cell.rs
    let h: number | null | undefined
    if (cell.r >= p) r += n
    else if (cell.r + cell.rs > p) {
      rs += n
      straddle.push(cell)
      const old = hOf(parts)
      if (old !== null) h = r2((old * rs) / cell.rs)
    }
    items.push({ key: cell.def, seq: 0, r, c: cell.c, rs, cs: cell.cs, parts, body: bodyOf(cell, getLine), h })
  }
  for (let i = 0; i < n; i++) {
    let col = 0
    while (straddle.some((s) => col >= s.c && col < s.c + s.cs)) col++
    if (col >= info.cols) continue
    items.push({
      key: NEW_KEY, seq: i, r: p + i, c: col, rs: 1, cs: 1,
      parts: emptyDef(info, getLine), body: [], h: info.heights[rect.r1 + i]
    })
  }
  ensureLastRow(info, getLine, items, rows + n, info.heights[Math.min(rows - 1, rect.r2)])
  return assemble(info, getLine, items, null)
}

export function insertCols(info: GridInfo, rect: Rect, after: boolean, getLine: GetLine): GridResult {
  const n = rect.c2 - rect.c1 + 1
  if (info.cols + n > MAX_COLS) return fail(`열은 ${MAX_COLS}개까지예요.`)
  const p = after ? rect.c2 + 1 : rect.c1
  const items: Out[] = []
  for (const cell of info.cells) {
    if (cell.def === null) continue
    let c = cell.c
    let cs = cell.cs
    if (cell.c >= p) c += n
    else if (cell.c + cell.cs > p) cs += n
    items.push({
      key: cell.def, seq: 0, r: cell.r, c, rs: cell.rs, cs,
      parts: parseDef(getLine(cell.def)), body: bodyOf(cell, getLine)
    })
  }
  let widths: number[] | null = null
  if (info.widths.some((w) => w !== null)) {
    const eff = effectiveWidths(info.widths, info.cols)
    const total = eff.reduce((a, b) => a + b, 0)
    const list = [...eff]
    list.splice(p, 0, ...Array.from({ length: n }, (_, i) => eff[rect.c1 + i]))
    widths = fitWidths(list, total)
    if (widths === null) return fail('열이 너무 좁아져서 더 추가할 수 없어요.')
  }
  ensureLastRow(info, getLine, items, info.heights.length, info.heights[info.heights.length - 1])
  return assemble(info, getLine, items, { n: info.cols + n, widths })
}

export function deleteRows(info: GridInfo, rect: Rect, getLine: GetLine): GridResult {
  const n = rect.r2 - rect.r1 + 1
  const rows = info.heights.length
  if (n >= rows) return fail('줄이 하나는 남아야 해요.')
  const items: Out[] = []
  for (const cell of info.cells) {
    const hit = cell.r + cell.rs > rect.r1 && cell.r <= rect.r2
    if (hit) {
      if (cell.r < rect.r1 || cell.r + cell.rs - 1 > rect.r2) {
        return fail('합친 칸이 걸쳐 있어서 지울 수 없어요. 먼저 칸을 나눠 주세요.')
      }
      continue
    }
    if (cell.def === null) continue
    items.push({
      key: cell.def, seq: 0, r: cell.r > rect.r2 ? cell.r - n : cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
      parts: parseDef(getLine(cell.def)), body: bodyOf(cell, getLine)
    })
  }
  const keepLast = rect.r2 === rows - 1 ? rect.r1 - 1 : rows - 1
  ensureLastRow(info, getLine, items, rows - n, info.heights[keepLast])
  return assemble(info, getLine, items, null)
}

export function deleteCols(info: GridInfo, rect: Rect, getLine: GetLine): GridResult {
  const n = rect.c2 - rect.c1 + 1
  if (n >= info.cols) return fail('열이 하나는 남아야 해요.')
  const items: Out[] = []
  for (const cell of info.cells) {
    const hit = cell.c + cell.cs > rect.c1 && cell.c <= rect.c2
    if (hit) {
      if (cell.c < rect.c1 || cell.c + cell.cs - 1 > rect.c2) {
        return fail('합친 칸이 걸쳐 있어서 지울 수 없어요. 먼저 칸을 나눠 주세요.')
      }
      continue
    }
    if (cell.def === null) continue
    items.push({
      key: cell.def, seq: 0, r: cell.r, c: cell.c > rect.c2 ? cell.c - n : cell.c, rs: cell.rs, cs: cell.cs,
      parts: parseDef(getLine(cell.def)), body: bodyOf(cell, getLine)
    })
  }
  let widths: number[] | null = null
  if (info.widths.some((w) => w !== null)) {
    const eff = effectiveWidths(info.widths, info.cols)
    const total = eff.reduce((a, b) => a + b, 0)
    widths = fitWidths(eff.filter((_, i) => i < rect.c1 || i > rect.c2), total)
    if (widths === null) return fail('열이 너무 좁아져서 지울 수 없어요.')
  }
  ensureLastRow(info, getLine, items, info.heights.length, info.heights[info.heights.length - 1])
  return assemble(info, getLine, items, { n: info.cols - n, widths })
}

const MIN_COL_MM = 5
const MIN_ROW_MM = 3
const snap = (v: number, step: number): number => Math.round(v / step) * step

export function dragColWidths(info: GridInfo, k: number, deltaMm: number, step = 0.5): number[] | null {
  if (k < 0 || k + 1 >= info.cols) return null
  const eff = effectiveWidths(info.widths, info.cols).map(r2)
  const pair = r2(eff[k] + eff[k + 1])
  if (pair < MIN_COL_MM * 2) return null
  const left = Math.min(pair - MIN_COL_MM, Math.max(MIN_COL_MM, snap(eff[k] + deltaMm, step)))
  const out = [...eff]
  out[k] = r2(left)
  out[k + 1] = r2(pair - out[k])
  return out
}

export function setColWidths(info: GridInfo, widths: number[], getLine: GetLine): GridResult {
  if (widths.length !== info.cols) return fail('열 수가 맞지 않아요.')
  if (widths.some((w) => !(w >= MIN_COL_MM))) return fail('열이 너무 좁아요.')
  const items: Out[] = []
  for (const cell of info.cells) {
    if (cell.def === null) continue
    items.push({
      key: cell.def, seq: 0, r: cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
      parts: parseDef(getLine(cell.def)), body: bodyOf(cell, getLine)
    })
  }
  return assemble(info, getLine, items, { n: info.cols, widths: widths.map(r2) })
}

export function setRowHeight(info: GridInfo, row: number, h: number, getLine: GetLine, step = 0.5): GridResult {
  const H = r2(Math.min(MAX_MM, Math.max(MIN_ROW_MM, snap(h, step))))
  const items: Out[] = []
  let carried = false
  for (const cell of info.cells) {
    if (cell.def === null) continue
    const own = cell.rs === 1 && cell.r === row
    if (own) carried = true
    items.push({
      key: cell.def, seq: 0, r: cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
      parts: parseDef(getLine(cell.def)), body: bodyOf(cell, getLine), h: own ? H : undefined
    })
  }
  if (!carried) {
    const covered = (c: number): boolean =>
      info.cells.some((x) => x.def !== null && x.r <= row && row < x.r + x.rs && c >= x.c && c < x.c + x.cs)
    let col = 0
    while (col < info.cols && covered(col)) col++
    if (col >= info.cols) return fail('합친 칸이 이 줄을 덮고 있어서 높이를 바꿀 수 없어요.')
    items.push({ key: NEW_KEY, seq: 0, r: row, c: col, rs: 1, cs: 1, parts: emptyDef(info, getLine), body: [], h: H })
  }
  return assemble(info, getLine, items, null)
}

export type BorderWhere =
  | 'all'
  | 'outer'
  | 'inner'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'vmid'
  | 'hmid'
export type BorderKind = 'none' | 'solid' | 'thick' | 'double' | 'dashed'
export interface BorderStyle {
  kind: BorderKind
  w: number | null
  c: string | null
}
type Side = 't' | 'b' | 'l' | 'r'
const SIDES: Side[] = ['t', 'b', 'l', 'r']
const SIDE_WORD: Record<Side, string> = { t: 'top', b: 'bottom', l: 'left', r: 'right' }
const OPPOSITE: Record<Side, Side> = { t: 'b', b: 't', l: 'r', r: 'l' }

export function borderValue(st: BorderStyle): string {
  if (st.kind === 'none' || (st.w === null && st.c === null)) return st.kind
  const parts: string[] = [st.kind, st.w === null ? '-' : String(r2(st.w))]
  if (st.c !== null) parts.push(st.c)
  return parts.join(',')
}

function withOpts(p: DefParts, put: Record<string, string>, remove: string[] = []): DefParts {
  const drop = [...Object.keys(put), ...remove].map((k) => `${k}=`)
  const keep = (t: string): boolean => !drop.some((d) => t.startsWith(d))
  const add = Object.entries(put).map(([k, v]) => `${k}=${v}`)
  const head = p.head.filter(keep)
  if (p.tail === null) return { ...p, head: [...head, ...add] }
  return { ...p, head, tail: [...p.tail.filter(keep), ...add] }
}

function hasExplicit(p: DefParts, side: Side): boolean {
  return [...p.head, ...(p.tail ?? [])].some((t) => t.startsWith('border=') || t.startsWith(`border-${SIDE_WORD[side]}=`))
}

function withFrame(line: string, st: BorderStyle): string {
  const indent = /^\s*/.exec(line)?.[0] ?? ''
  const toks = tokenize(line.trim().replace(/\[$/, '').trim()).filter((t) => !/^frame=/.test(t))
  const v = borderValue(st)
  if (v !== 'solid') toks.push(`frame=${v}`)
  return `${indent}${toks.join(' ')} [`
}

export function setBorders(
  info: GridInfo,
  rect: Rect,
  where: BorderWhere,
  st: BorderStyle,
  getLine: GetLine
): GridResult {
  const inside = cellsIn(info, rect)
  if (typeof inside === 'string') return fail(inside)
  const rows = info.heights.length
  const value = borderValue(st)
  const picked = new Set(inside)
  const wholeGrid = rect.r1 === 0 && rect.c1 === 0 && rect.r2 === rows - 1 && rect.c2 === info.cols - 1
  const frame = wholeGrid && (where === 'all' || where === 'outer')
  const edits = new Map<CellInfo, Partial<Record<Side, string>>>()
  const put = (c: CellInfo, s: Side): void => {
    const e = edits.get(c) ?? {}
    e[s] = value
    edits.set(c, e)
  }
  const cache = new Map<CellInfo, DefParts>()
  const defOf = (c: CellInfo): DefParts | null => {
    if (c.def === null) return null
    let p = cache.get(c)
    if (!p) {
      p = parseDef(getLine(c.def))
      cache.set(c, p)
    }
    return p
  }
  for (const c of inside) {
    for (const s of SIDES) {
      const outer =
        (s === 't' && c.r === rect.r1) ||
        (s === 'b' && c.r + c.rs - 1 === rect.r2) ||
        (s === 'l' && c.c === rect.c1) ||
        (s === 'r' && c.c + c.cs - 1 === rect.c2)
      const horiz = s === 'l' || s === 'r'
      const want =
        where === 'all' ||
        (where === 'outer' && outer) ||
        (where === 'inner' && !outer) ||
        (where === 'vmid' && !outer && horiz) ||
        (where === 'hmid' && !outer && !horiz) ||
        (outer &&
          ((where === 'top' && s === 't') ||
            (where === 'bottom' && s === 'b') ||
            (where === 'left' && s === 'l') ||
            (where === 'right' && s === 'r')))
      if (!want) continue
      const atGrid =
        (s === 't' && c.r === 0) ||
        (s === 'b' && c.r + c.rs === rows) ||
        (s === 'l' && c.c === 0) ||
        (s === 'r' && c.c + c.cs === info.cols)
      if (atGrid && frame) continue
      put(c, s)
      for (const n of info.cells) {
        if (picked.has(n) || n === c) continue
        const touches =
          s === 't' ? n.r + n.rs === c.r && n.c < c.c + c.cs && n.c + n.cs > c.c
          : s === 'b' ? n.r === c.r + c.rs && n.c < c.c + c.cs && n.c + n.cs > c.c
          : s === 'l' ? n.c + n.cs === c.c && n.r < c.r + c.rs && n.r + n.rs > c.r
          : n.c === c.c + c.cs && n.r < c.r + c.rs && n.r + n.rs > c.r
        const p = touches ? defOf(n) : null
        const horizEdge = s === 't' || s === 'b'
        const nSpan = horizEdge ? n.cs : n.rs
        const cSpan = horizEdge ? c.cs : c.rs
        if (p && nSpan <= cSpan && hasExplicit(p, OPPOSITE[s])) put(n, OPPOSITE[s])
      }
    }
  }
  const wipe = where === 'all' && st.kind === 'none'
  if (edits.size === 0 && !frame && !wipe) {
    return fail('이 위치에는 바꿀 선이 없어요. 안쪽 선은 칸을 둘 이상 선택해야 해요.')
  }
  const items: Out[] = []
  for (const cell of info.cells) {
    const e = edits.get(cell)
    const opts: Record<string, string> = {}
    if (e) for (const s of SIDES) if (e[s] !== undefined) opts[`border-${SIDE_WORD[s]}`] = e[s] as string
    if (cell.def === null) {
      if (e) {
        items.push({
          key: NEW_KEY, seq: items.length, r: cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
          parts: withOpts(emptyDef(info, getLine), opts), body: []
        })
      }
      continue
    }
    const parts = parseDef(getLine(cell.def))
    const clear = wipe && picked.has(cell)
    items.push({
      key: cell.def, seq: 0, r: cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
      parts: e || clear ? withOpts(parts, opts, clear ? ['diag-down', 'diag-up'] : []) : parts,
      body: bodyOf(cell, getLine)
    })
  }
  const res = assemble(info, getLine, items, null)
  if (res.ok && frame) res.lines[0] = withFrame(res.lines[0], st)
  return res
}

export function setDiagonals(
  info: GridInfo,
  rect: Rect,
  dir: 'down' | 'up',
  st: BorderStyle,
  getLine: GetLine
): GridResult {
  const inside = cellsIn(info, rect)
  if (typeof inside === 'string') return fail(inside)
  const key = dir === 'down' ? 'diag-down' : 'diag-up'
  const picked = new Set(inside)
  const items: Out[] = []
  for (const cell of info.cells) {
    const on = picked.has(cell)
    const put: Record<string, string> = on && st.kind !== 'none' ? { [key]: borderValue(st) } : {}
    const remove = on && st.kind === 'none' ? [key] : []
    if (cell.def === null) {
      if (on && st.kind !== 'none') {
        items.push({
          key: NEW_KEY, seq: items.length, r: cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
          parts: withOpts(emptyDef(info, getLine), put), body: []
        })
      }
      continue
    }
    const parts = parseDef(getLine(cell.def))
    items.push({
      key: cell.def, seq: 0, r: cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
      parts: on ? withOpts(parts, put, remove) : parts, body: bodyOf(cell, getLine)
    })
  }
  return assemble(info, getLine, items, null)
}


export type FlagName = 'bold' | 'italic' | 'underline' | 'strike'
export type HAlign = 'left' | 'center' | 'right' | 'justify' | 'distribute'
export type VAlign = 'top' | 'middle' | 'bottom'

export interface CellOptChange {
  flags?: Partial<Record<FlagName, boolean>>
  kv?: Partial<Record<'ff' | 'fs' | 'fc' | 'bg', string | null>>
  align?: HAlign | null
  valign?: VAlign | null
}

export interface CellOptState {
  flags: Record<FlagName, boolean>
  ff: string | null
  fs: string | null
  fc: string | null
  bg: string | null
  align: HAlign | null
  valign: VAlign | null
}

const H_WORDS: HAlign[] = ['left', 'center', 'right', 'justify', 'distribute']
const V_WORDS: VAlign[] = ['top', 'middle', 'bottom']
const FLAG_WORDS: FlagName[] = ['bold', 'italic', 'underline', 'strike']

function applyOptChange(p: DefParts, ch: CellOptChange): DefParts {
  const kvKeys = Object.keys(ch.kv ?? {})
  const dropWords = new Set<string>()
  const addWords: string[] = []
  for (const [f, on] of Object.entries(ch.flags ?? {})) {
    dropWords.add(f)
    if (on) addWords.push(f)
  }
  if (ch.align !== undefined) {
    H_WORDS.forEach((w) => dropWords.add(w))
    if (ch.align) addWords.push(ch.align)
  }
  if (ch.valign !== undefined) {
    V_WORDS.forEach((w) => dropWords.add(w))
    if (ch.valign) addWords.push(ch.valign)
  }
  const keep = (t: string): boolean =>
    !dropWords.has(t) && !kvKeys.some((k) => t.startsWith(`${k}=`))
  const q = (v: string): string => (/\s/.test(v) ? `"${v}"` : v)
  const add = [
    ...kvKeys.flatMap((k) => {
      const v = (ch.kv as Record<string, string | null>)[k]
      return v === null || v === '' ? [] : [`${k}=${q(v)}`]
    }),
    ...addWords
  ]
  const head = p.head.filter(keep)
  if (p.tail === null) return { ...p, head: [...head, ...add] }
  return { ...p, head, tail: [...p.tail.filter(keep), ...add] }
}

export function setCellOpts(
  info: GridInfo,
  rect: Rect,
  ch: CellOptChange,
  getLine: GetLine
): GridResult {
  const inside = cellsIn(info, rect)
  if (typeof inside === 'string') return fail(inside)
  const picked = new Set(inside)
  const items: Out[] = []
  for (const cell of info.cells) {
    const on = picked.has(cell)
    if (cell.def === null) {
      if (on) {
        items.push({
          key: NEW_KEY, seq: items.length, r: cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
          parts: applyOptChange(emptyDef(info, getLine), ch), body: []
        })
      }
      continue
    }
    const parts = parseDef(getLine(cell.def))
    items.push({
      key: cell.def, seq: 0, r: cell.r, c: cell.c, rs: cell.rs, cs: cell.cs,
      parts: on ? applyOptChange(parts, ch) : parts, body: bodyOf(cell, getLine)
    })
  }
  return assemble(info, getLine, items, null)
}

export function readCellOpts(info: GridInfo, rect: Rect, getLine: GetLine): CellOptState {
  const inside = cellsIn(info, rect)
  const cells = typeof inside === 'string' ? [] : inside
  const toks = cells.map((c) => {
    if (c.def === null) return [] as string[]
    const p = parseDef(getLine(c.def))
    return [...p.head, ...(p.tail ?? [])]
  })
  const flags = {} as Record<FlagName, boolean>
  for (const f of FLAG_WORDS) flags[f] = toks.length > 0 && toks.every((t) => t.includes(f))
  const common = <T extends string>(pick: (t: string[]) => T | null): T | null => {
    if (toks.length === 0) return null
    const vals = toks.map(pick)
    return vals.every((v) => v === vals[0]) ? vals[0] : null
  }
  const kv = (k: string) => (t: string[]): string | null => {
    const hit = t.find((x) => x.startsWith(`${k}=`))
    return hit ? hit.slice(k.length + 1).replace(/^"|"$/g, '') : null
  }
  return {
    flags,
    ff: common(kv('ff')),
    fs: common(kv('fs')),
    fc: common(kv('fc')),
    bg: common(kv('bg')),
    align: common((t) => H_WORDS.find((w) => t.includes(w)) ?? null),
    valign: common((t) => V_WORDS.find((w) => t.includes(w)) ?? null)
  }
}