import {
  NEW_KEY,
  assemble,
  bodyOf,
  cellsIn,
  emptyDef,
  fail,
  parseDef,
  r2,
  tokenize,
  type CellInfo,
  type DefParts,
  type GetLine,
  type GridInfo,
  type GridResult,
  type Out,
  type Rect
} from './gridCore'

export type BorderWhere =
  'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'vmid' | 'hmid'
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
  return [...p.head, ...(p.tail ?? [])].some(
    (t) => t.startsWith('border=') || t.startsWith(`border-${SIDE_WORD[side]}=`)
  )
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
  const wholeGrid =
    rect.r1 === 0 && rect.c1 === 0 && rect.r2 === rows - 1 && rect.c2 === info.cols - 1
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
          s === 't'
            ? n.r + n.rs === c.r && n.c < c.c + c.cs && n.c + n.cs > c.c
            : s === 'b'
              ? n.r === c.r + c.rs && n.c < c.c + c.cs && n.c + n.cs > c.c
              : s === 'l'
                ? n.c + n.cs === c.c && n.r < c.r + c.rs && n.r + n.rs > c.r
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
    if (e)
      for (const s of SIDES) if (e[s] !== undefined) opts[`border-${SIDE_WORD[s]}`] = e[s] as string
    if (cell.def === null) {
      if (e) {
        items.push({
          key: NEW_KEY,
          seq: items.length,
          r: cell.r,
          c: cell.c,
          rs: cell.rs,
          cs: cell.cs,
          parts: withOpts(emptyDef(info, getLine), opts),
          body: []
        })
      }
      continue
    }
    const parts = parseDef(getLine(cell.def))
    const clear = wipe && picked.has(cell)
    items.push({
      key: cell.def,
      seq: 0,
      r: cell.r,
      c: cell.c,
      rs: cell.rs,
      cs: cell.cs,
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
          key: NEW_KEY,
          seq: items.length,
          r: cell.r,
          c: cell.c,
          rs: cell.rs,
          cs: cell.cs,
          parts: withOpts(emptyDef(info, getLine), put),
          body: []
        })
      }
      continue
    }
    const parts = parseDef(getLine(cell.def))
    items.push({
      key: cell.def,
      seq: 0,
      r: cell.r,
      c: cell.c,
      rs: cell.rs,
      cs: cell.cs,
      parts: on ? withOpts(parts, put, remove) : parts,
      body: bodyOf(cell, getLine)
    })
  }
  return assemble(info, getLine, items, null)
}