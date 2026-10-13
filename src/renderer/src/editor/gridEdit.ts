export { setBorders, setDiagonals, borderValue } from './gridBorder'
export type { BorderWhere, BorderKind, BorderStyle } from './gridBorder'
export { setCellOpts, readCellOpts } from './gridCellOpts'
export type { FlagName, HAlign, VAlign, CellOptChange, CellOptState } from './gridCellOpts'
export { dragColWidths, setColWidths, setRowHeight } from './gridSize'
import {
  MAX_COLS,
  MAX_MM,
  MAX_ROWS,
  NEW_KEY,
  assemble,
  bodyOf,
  cellsIn,
  demand,
  effectiveWidths,
  emptyDef,
  fail,
  hOf,
  parseDef,
  partition,
  r2,
  splitSizes,
  starts,
  sum,
  type CellInfo,
  type DefParts,
  type GetLine,
  type GridInfo,
  type GridResult,
  type Out,
  type Rect
} from './gridCore'

export type { CellInfo, GridInfo, GridResult, Rect } from './gridCore'
export function mergeGrid(info: GridInfo, rect: Rect, getLine: GetLine): GridResult {
  const inside = cellsIn(info, rect)
  if (typeof inside === 'string') return fail(inside)
  if (inside.length < 2) return fail('합칠 칸을 둘 이상 선택해 주세요.')
  const set = new Set(inside)
  const real = inside.filter((c) => c.def !== null).sort((a, b) => a.r - b.r || a.c - b.c)
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

function equalColumns(
  info: GridInfo,
  inside: CellInfo[],
  nCols: number
): Map<number, number> | null {
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
    for (let j = 0; j < info.cols;) {
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

function ensureLastRow(
  info: GridInfo,
  getLine: GetLine,
  items: Out[],
  rows: number,
  h: number
): void {
  if (items.some((it) => it.r + it.rs === rows)) return
  const used = new Set<number>()
  for (const it of items) {
    if (it.r <= rows - 1 && it.r + it.rs > rows - 1)
      for (let c = it.c; c < it.c + it.cs; c++) used.add(c)
  }
  let col = 0
  while (used.has(col)) col++
  items.push({
    key: NEW_KEY,
    seq: items.length,
    r: rows - 1,
    c: col,
    rs: 1,
    cs: 1,
    parts: emptyDef(info, getLine),
    body: [],
    h
  })
}

function fitWidths(list: number[], total: number): number[] | null {
  const now = list.reduce((a, b) => a + b, 0)
  return splitSizes(
    list.map((v) => (v * total) / now),
    list.map(() => 1)
  )
}

export function insertRows(
  info: GridInfo,
  rect: Rect,
  after: boolean,
  getLine: GetLine
): GridResult {
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
    items.push({
      key: cell.def,
      seq: 0,
      r,
      c: cell.c,
      rs,
      cs: cell.cs,
      parts,
      body: bodyOf(cell, getLine),
      h
    })
  }
  for (let i = 0; i < n; i++) {
    let col = 0
    while (straddle.some((s) => col >= s.c && col < s.c + s.cs)) col++
    if (col >= info.cols) continue
    items.push({
      key: NEW_KEY,
      seq: i,
      r: p + i,
      c: col,
      rs: 1,
      cs: 1,
      parts: emptyDef(info, getLine),
      body: [],
      h: info.heights[rect.r1 + i]
    })
  }
  ensureLastRow(info, getLine, items, rows + n, info.heights[Math.min(rows - 1, rect.r2)])
  return assemble(info, getLine, items, null)
}

export function insertCols(
  info: GridInfo,
  rect: Rect,
  after: boolean,
  getLine: GetLine
): GridResult {
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
      key: cell.def,
      seq: 0,
      r: cell.r,
      c,
      rs: cell.rs,
      cs,
      parts: parseDef(getLine(cell.def)),
      body: bodyOf(cell, getLine)
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
      key: cell.def,
      seq: 0,
      r: cell.r > rect.r2 ? cell.r - n : cell.r,
      c: cell.c,
      rs: cell.rs,
      cs: cell.cs,
      parts: parseDef(getLine(cell.def)),
      body: bodyOf(cell, getLine)
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
      key: cell.def,
      seq: 0,
      r: cell.r,
      c: cell.c > rect.c2 ? cell.c - n : cell.c,
      rs: cell.rs,
      cs: cell.cs,
      parts: parseDef(getLine(cell.def)),
      body: bodyOf(cell, getLine)
    })
  }
  let widths: number[] | null = null
  if (info.widths.some((w) => w !== null)) {
    const eff = effectiveWidths(info.widths, info.cols)
    const total = eff.reduce((a, b) => a + b, 0)
    widths = fitWidths(
      eff.filter((_, i) => i < rect.c1 || i > rect.c2),
      total
    )
    if (widths === null) return fail('열이 너무 좁아져서 지울 수 없어요.')
  }
  ensureLastRow(info, getLine, items, info.heights.length, info.heights[info.heights.length - 1])
  return assemble(info, getLine, items, { n: info.cols - n, widths })
}