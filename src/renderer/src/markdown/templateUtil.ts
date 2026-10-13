import type { Sides, Style } from './templateTypes'

export const OPEN_RE = /^template\s*\[$/
export const VALUE_OPEN_RE = /^value\s*\[$/
export const OPENER_RE = /^(?:box|table|chart|grid|row|value|template)\b[^[\]]*\[$/
export const DEF_RE = /^(?:col|row)\s*=/
export const MAX_LINES = 1500
export const MAX_DEPTH = 4
export const MAX_WARN = 8
export const MAX_ROWS = 200
export const DEFAULT_ROW_MM = 10
export const PAPER_MM = 186
const FILL_RE = /\{\{\s*([^{}\s]+)\s*\}\}/g
export const VAR_RE = /^([\p{L}\p{N}_][\p{L}\p{N}_.-]*)\s*:\s*(.*)$/u
const COLOR_NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
export const H_ALIGN = ['left', 'center', 'right', 'justify', 'distribute']
export const V_ALIGN = ['top', 'middle', 'bottom']
export const LINE_KINDS = ['solid', 'thick', 'double', 'dashed']
export const EDGE_KINDS = ['none', 'solid', 'thick', 'double', 'dashed']
export const SIDE_KEY = { left: 'l', right: 'r', top: 't', bottom: 'b' } as const
export const TEXT_DENY = new Set(['h', 'p', 'border', 'line', 'valign', 'vertical'])

export const ALL_SIDES: Sides = { l: true, t: true, r: true, b: true }
export const NO_SIDES: Sides = { l: false, t: false, r: false, b: false }
export const DEFAULT_STYLE: Style = {
  ff: null,
  fs: 10,
  ls: null,
  lh: null,
  fc: null,
  bg: null,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  align: 'left',
  valign: 'middle',
  vertical: false,
  p: null,
  edges: { l: 'solid', t: 'solid', r: 'solid', b: 'solid' },
  ec: null,
  set: {},
  ex: {},
  dd: null,
  du: null
}

export const isColor = (v: string): boolean => COLOR_NAMES.includes(v) || HEX_RE.test(v)
export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))
export const fill = (s: string, vars: Map<string, string>): string =>
  s.replace(FILL_RE, (m, k: string) => (vars.has(k) ? (vars.get(k) as string) : m))
export const unesc = (s: string): string => s.replace(/\\n/g, '\n')
export const indentOf = (s: string): number => s.length - s.trimStart().length
export const unquote = (v: string): string =>
  v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v.replace(/^"/, '')

/** 공백으로 나누되 큰따옴표 안의 공백은 나누지 않는다. */
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

/** 따옴표 밖의 첫 ':' 앞뒤로 나눈다. 없으면 [전체, null]. */
export function splitColon(src: string): [string, string | null] {
  let q = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') q = !q
    else if (ch === ':' && !q) return [src.slice(0, i), src.slice(i + 1)]
  }
  return [src, null]
}

export function num(v: string, lo: number, hi: number): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null
}

export function nextRaw(lines: string[], pos: { i: number }): string | null {
  while (pos.i < lines.length) {
    const s = lines[pos.i++]
    if (s.trim() !== '') return s
  }
  return null
}

export function skipBlock(lines: string[], pos: { i: number }): void {
  let d = 1
  while (d > 0) {
    const raw = nextRaw(lines, pos)
    if (raw === null) return
    const t = raw.trim()
    if (OPENER_RE.test(t)) d++
    else if (t === ']') d--
  }
}