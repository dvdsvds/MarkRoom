import type {
  Align,
  Diag,
  EdgeExtra,
  EdgeKind,
  Edges,
  LineKind,
  Opt,
  Scope,
  Sides,
  Style,
  VAlign
} from './templateTypes'
import {
  ALL_SIDES,
  EDGE_KINDS,
  H_ALIGN,
  LINE_KINDS,
  MAX_WARN,
  NO_SIDES,
  SIDE_KEY,
  TEXT_DENY,
  V_ALIGN,
  isColor,
  num,
  unquote
} from './templateUtil'

export class Ctx {
  warnings: string[] = []
  lineBase = 1
  warn(msg: string): void {
    if (this.warnings.length < MAX_WARN) this.warnings.push(msg)
    else if (this.warnings.length === MAX_WARN) this.warnings.push('…경고가 더 있어요.')
  }
}

function parseBorder(val: string): Sides | null {
  const v = val.trim()
  if (v === 'all') return ALL_SIDES
  if (v === 'none') return NO_SIDES
  const s: Sides = { ...ALL_SIDES }
  for (const part of v.split(',')) {
    const m = /^-(left|right|top|bottom)$/.exec(part.trim())
    if (!m) return null
    s[SIDE_KEY[m[1] as keyof typeof SIDE_KEY]] = false
  }
  return s
}

export function parseEdgeValue(
  val: string,
  kinds: readonly string[]
): { kind: string; w: number | null; c: string | null } | string {
  const parts = val.split(',').map((x) => x.trim())
  if (parts.length > 3 || !kinds.includes(parts[0])) return `종류는 ${kinds.join(', ')} 중 하나예요`
  let w: number | null = null
  if (parts[1] !== undefined && parts[1] !== '' && parts[1] !== '-') {
    w = num(parts[1], 0.05, 5)
    if (w === null) return '굵기는 0.05~5mm 범위의 숫자예요'
  }
  let c: string | null = null
  if (parts[2] !== undefined && parts[2] !== '' && parts[2] !== '-') {
    if (!isColor(parts[2])) return `색이 아니에요: ${parts[2]}`
    c = parts[2]
  }
  return { kind: parts[0], w, c }
}

export function parseOpts(tokens: string[], ctx: Ctx, where: string, scope: Scope): Opt {
  const o: Opt = {}
  const deny = (name: string): boolean => {
    if (scope === 'text' && TEXT_DENY.has(name)) {
      ctx.warn(`${where}: text에서는 쓰지 않는 옵션이에요: ${name}`)
      return true
    }
    if (scope === 'page' && name === 'h') {
      ctx.warn('page에서는 h=를 쓸 수 없어요. 무시했어요.')
      return true
    }
    return false
  }
  for (const w of tokens) {
    const eq = w.indexOf('=')
    if (eq < 0) {
      if (H_ALIGN.includes(w)) o.align = w as Align
      else if (V_ALIGN.includes(w)) {
        if (!deny('valign')) o.valign = w as VAlign
      } else if (w === 'bold' || w === 'italic' || w === 'underline' || w === 'strike') {
        o[w] = true
      } else if (w === 'vertical') {
        if (!deny('vertical')) o.vertical = true
      } else {
        ctx.warn(`${where}: 모르는 옵션이에요: ${w}`)
      }
      continue
    }
    const key = w.slice(0, eq)
    const val = unquote(w.slice(eq + 1))
    if (key === 'col' || key === 'row') {
      ctx.warn(`${where}: ${key}=는 여기서 쓸 수 없어요. 무시했어요.`)
      continue
    }
    if (key === 'ff') {
      const name = val
        .replace(/["\\;{}<>\r\n]/g, '')
        .trim()
        .slice(0, 60)
      if (name === '') ctx.warn(`${where}: ff= 글꼴 이름이 비어 있어요.`)
      else o.ff = name
    } else if (key === 'fs' || key === 'ls' || key === 'lh' || key === 'p' || key === 'h') {
      if (deny(key)) continue
      const range: Record<string, [number, number, string]> = {
        fs: [1, 200, '1~200pt'],
        ls: [-5, 50, '-5~50pt'],
        lh: [0.5, 5, '0.5~5배'],
        p: [0, 40, '0~40pt'],
        h: [1, 280, '1~280mm']
      }
      const [lo, hi, label] = range[key]
      const n = num(val, lo, hi)
      if (n === null) ctx.warn(`${where}: ${key}= 값은 ${label} 범위의 숫자예요: ${val}`)
      else if (key === 'fs') o.fs = n
      else if (key === 'ls') o.ls = n
      else if (key === 'lh') o.lh = n
      else if (key === 'p') o.p = n
      else o.h = n
    } else if (key === 'fc' || key === 'bg') {
      if (!isColor(val)) ctx.warn(`${where}: ${key}= 값이 색이 아니에요: ${val}`)
      else if (key === 'fc') o.fc = val
      else o.bg = val
    } else if (key === 'border') {
      if (deny('border')) continue
      const b = parseBorder(val)
      if (b === null)
        ctx.warn(`${where}: border= 값이 틀려요. none, all, -left,-top 처럼 써 주세요: ${val}`)
      else o.border = b
    } else if (/^border-(top|right|bottom|left)$/.test(key)) {
      if (deny('border')) continue
      const v = parseEdgeValue(val, EDGE_KINDS)
      if (typeof v === 'string') {
        ctx.warn(`${where}: ${key}= ${v}: ${val}`)
      } else {
        const side = SIDE_KEY[key.slice(7) as keyof typeof SIDE_KEY]
        o.sides = { ...(o.sides ?? {}), [side]: v.kind as EdgeKind }
        o.sideEx = { ...(o.sideEx ?? {}), [side]: { w: v.w, c: v.c } }
      }
    } else if (key === 'diag-down' || key === 'diag-up') {
      if (deny('border')) continue
      const v = parseEdgeValue(val, EDGE_KINDS)
      if (typeof v === 'string') {
        ctx.warn(`${where}: ${key}= ${v}: ${val}`)
      } else {
        const d: Diag | null =
          v.kind === 'none' ? null : { kind: v.kind as LineKind, w: v.w, c: v.c }
        if (key === 'diag-down') o.dd = d
        else o.du = d
      }
    } else if (key === 'border-color') {
      if (deny('border')) continue
      if (!isColor(val)) ctx.warn(`${where}: border-color= 값이 색이 아니에요: ${val}`)
      else o.ec = val
    } else if (key === 'line') {
      if (deny('line')) continue
      if (!LINE_KINDS.includes(val))
        ctx.warn(`${where}: line= 값은 solid, thick, double, dashed 중 하나예요: ${val}`)
      else o.line = val as LineKind
    } else {
      ctx.warn(`${where}: 모르는 옵션이에요: ${w}`)
    }
  }
  return o
}

export function merge(base: Style, o: Opt): Style {
  const e: Edges = { ...base.edges }
  const set: Partial<Edges> = { ...base.set }
  const ex: Partial<Record<keyof Edges, EdgeExtra>> = { ...base.ex }
  const keys = ['l', 't', 'r', 'b'] as const
  if (o.border) {
    for (const k of keys) {
      if (!o.border[k]) {
        e[k] = 'none'
        set[k] = 'none'
      } else if (e[k] === 'none') {
        e[k] = o.line ?? 'solid'
        set[k] = e[k]
      }
    }
  }
  if (o.line) {
    for (const k of keys) {
      if (e[k] !== 'none') {
        e[k] = o.line
        set[k] = o.line
      }
    }
  }
  if (o.sides) {
    for (const k of keys) {
      const v = o.sides[k]
      if (v !== undefined) {
        e[k] = v
        set[k] = v
        const x = o.sideEx?.[k]
        if (x && (x.w !== null || x.c !== null)) ex[k] = x
        else delete ex[k]
      }
    }
  }
  return {
    ff: o.ff ?? base.ff,
    fs: o.fs ?? base.fs,
    ls: o.ls ?? base.ls,
    lh: o.lh ?? base.lh,
    fc: o.fc ?? base.fc,
    bg: o.bg ?? base.bg,
    bold: o.bold ?? base.bold,
    italic: o.italic ?? base.italic,
    underline: o.underline ?? base.underline,
    strike: o.strike ?? base.strike,
    align: o.align ?? base.align,
    valign: o.valign ?? base.valign,
    vertical: o.vertical ?? base.vertical,
    p: o.p ?? base.p,
    edges: e,
    ec: o.ec ?? base.ec,
    set,
    ex,
    dd: o.dd !== undefined ? o.dd : base.dd,
    du: o.du !== undefined ? o.du : base.du
  }
}