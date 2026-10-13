import {
  NEW_KEY,
  assemble,
  bodyOf,
  cellsIn,
  emptyDef,
  fail,
  parseDef,
  type DefParts,
  type GetLine,
  type GridInfo,
  type GridResult,
  type Out,
  type Rect
} from './gridCore'

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
          key: NEW_KEY,
          seq: items.length,
          r: cell.r,
          c: cell.c,
          rs: cell.rs,
          cs: cell.cs,
          parts: applyOptChange(emptyDef(info, getLine), ch),
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
      parts: on ? applyOptChange(parts, ch) : parts,
      body: bodyOf(cell, getLine)
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
  const kv =
    (k: string) =>
    (t: string[]): string | null => {
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