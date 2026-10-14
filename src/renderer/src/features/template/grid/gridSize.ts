import {
  NEW_KEY,
  assemble,
  bodyOf,
  effectiveWidths,
  emptyDef,
  fail,
  parseDef,
  r2,
  MAX_MM,
  type GetLine,
  type GridInfo,
  type GridResult,
  type Out
} from './gridCore'

const MIN_COL_MM = 5
const MIN_ROW_MM = 3
const snap = (v: number, step: number): number => Math.round(v / step) * step

export function dragColWidths(
  info: GridInfo,
  k: number,
  deltaMm: number,
  step = 0.5
): number[] | null {
  if (k < 0 || k + 1 >= info.cols) return null
  const eff = effectiveWidths(info.widths, info.cols, info.frameMm).map(r2)
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
  return assemble(info, getLine, items, { n: info.cols, widths: widths.map(r2) })
}

export function setRowHeight(
  info: GridInfo,
  row: number,
  h: number,
  getLine: GetLine,
  step = 0.5
): GridResult {
  const H = r2(Math.min(MAX_MM, Math.max(MIN_ROW_MM, snap(h, step))))
  const items: Out[] = []
  let carried = false
  for (const cell of info.cells) {
    if (cell.def === null) continue
    const own = cell.rs === 1 && cell.r === row
    if (own) carried = true
    items.push({
      key: cell.def,
      seq: 0,
      r: cell.r,
      c: cell.c,
      rs: cell.rs,
      cs: cell.cs,
      parts: parseDef(getLine(cell.def)),
      body: bodyOf(cell, getLine),
      h: own ? H : undefined
    })
  }
  if (!carried) {
    const covered = (c: number): boolean =>
      info.cells.some(
        (x) => x.def !== null && x.r <= row && row < x.r + x.rs && c >= x.c && c < x.c + x.cs
      )
    let col = 0
    while (col < info.cols && covered(col)) col++
    if (col >= info.cols) return fail('합친 칸이 이 줄을 덮고 있어서 높이를 바꿀 수 없어요.')
    items.push({
      key: NEW_KEY,
      seq: 0,
      r: row,
      c: col,
      rs: 1,
      cs: 1,
      parts: emptyDef(info, getLine),
      body: [],
      h: H
    })
  }
  return assemble(info, getLine, items, null)
}