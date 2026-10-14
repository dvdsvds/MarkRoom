import type {
  Diag,
  EdgeKind,
  Edges,
  LineKind,
  ParsedTemplate,
  Style,
  TNode
} from '../parse/templatePlugin'
import { fontCandidates } from '../../../utils/systemFonts'
import { plainInline, splitInline, type InlineOpts } from '../../../components/inlineText'
import { renderMath, splitMath } from '../../../components/mathText'
import { renderBlocks } from '../../../components/outputBlocks'

type Ok = Exclude<ParsedTemplate, { error: string }>

const NAMED = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const SERIF_RE =
  /바탕|명조|궁서|batang|myeongjo|myungjo|serif|times|georgia|garamond|palatino|gungsuh/i
const PAPER_MM = 186
const V_ITEMS = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const
const GUIDE = '1px dashed #e5484d'

function textColor(v: string | null): string | null {
  if (!v) return null
  if (NAMED.includes(v)) return `var(--c-${v})`
  return HEX_RE.test(v) ? v : null
}

function backColor(v: string | null): string | null {
  if (!v) return null
  if (NAMED.includes(v)) return `color-mix(in srgb, var(--c-${v}) 40%, transparent)`
  return HEX_RE.test(v) ? v : null
}

function fontFamily(name: string): string {
  const safe = name.replace(/["\\]/g, '')
  const serif = SERIF_RE.test(safe) && !/sans/i.test(safe)
  const list = fontCandidates(name).map((f) => `"${f}"`)
  return `${list.join(', ')}, ${serif ? 'serif' : 'Pretendard, sans-serif'}`
}

function edgeWidth(kind: EdgeKind, mm: number | null): string {
  const base = kind === 'thick' || kind === 'double' ? '3px' : '1px'
  return mm === null ? base : `${kind === 'double' ? Math.max(mm, 0.8) : mm}mm`
}

function edgeCss(kind: EdgeKind, color: string | null, mm: number | null = null): string {
  if (kind === 'none') return '0'
  const w = edgeWidth(kind, mm)
  const st = kind === 'dashed' ? 'dashed' : kind === 'double' ? 'double' : 'solid'
  return `${w} ${st} ${textColor(color) ?? 'var(--tp-ink)'}`
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function addDiag(cell: HTMLElement, dir: 'down' | 'up', dg: Diag): void {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'tq-diag')
  svg.style.cssText =
    'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none'
  const ink = textColor(dg.c) ?? 'var(--tp-ink)'
  const px =
    dg.w !== null ? (dg.w * 96) / 25.4 : dg.kind === 'thick' || dg.kind === 'double' ? 3 : 1
  const add = (dy: number, sw: number): void => {
    const ln = document.createElementNS(SVG_NS, 'line')
    ln.setAttribute('x1', '0')
    ln.setAttribute('y1', dir === 'down' ? '0' : '100%')
    ln.setAttribute('x2', '100%')
    ln.setAttribute('y2', dir === 'down' ? '100%' : '0')
    ln.setAttribute('stroke', ink)
    ln.setAttribute('stroke-width', String(sw))
    if (dg.kind === 'dashed')
      ln.setAttribute('stroke-dasharray', `${Math.max(3, sw * 3)} ${Math.max(2, sw * 2)}`)
    if (dy !== 0) ln.setAttribute('transform', `translate(0 ${dy})`)
    svg.appendChild(ln)
  }
  if (dg.kind === 'double') {
    const sw = Math.max(0.75, px / 3)
    add(-sw, sw)
    add(sw, sw)
  } else {
    add(0, px)
  }
  cell.appendChild(svg)
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function applyStyle(e: HTMLElement, s: Style): void {
  if (s.ff) e.style.fontFamily = fontFamily(s.ff)
  e.style.fontSize = `${s.fs}pt`
  if (s.ls !== null) e.style.letterSpacing = `${s.ls}pt`
  if (s.lh !== null) e.style.lineHeight = String(s.lh)
  const fc = textColor(s.fc)
  if (fc) e.style.color = fc
  if (s.bold) e.style.fontWeight = '700'
  if (s.italic) e.style.fontStyle = 'italic'
  const deco: string[] = []
  if (s.underline) deco.push('underline')
  if (s.strike) deco.push('line-through')
  if (deco.length > 0) e.style.textDecoration = deco.join(' ')
}

const SCRIPT_RE = /\^([^\s^]{1,20})\^|~([^\s~]{1,20})~/g

function scriptText(target: HTMLElement, text: string): void {
  let last = 0
  let any = false
  for (const m of text.matchAll(SCRIPT_RE)) {
    const at = m.index ?? 0
    if (at > last) target.appendChild(document.createTextNode(text.slice(last, at)))
    const sup = m[1] !== undefined
    const e = document.createElement(sup ? 'sup' : 'sub')
    e.textContent = sup ? m[1] : m[2]
    e.style.fontSize = '0.7em'
    e.style.lineHeight = '0'
    e.style.verticalAlign = 'baseline'
    e.style.position = 'relative'
    e.style.top = sup ? '-0.45em' : '0.12em'
    target.appendChild(e)
    last = at + m[0].length
    any = true
  }
  if (!any) {
    target.appendChild(document.createTextNode(text))
    return
  }
  if (last < text.length) target.appendChild(document.createTextNode(text.slice(last)))
}

function richPlain(target: HTMLElement, text: string): void {
  const pieces = splitMath(text)
  if (!pieces.some((p) => 'tex' in p)) {
    scriptText(target, text)
    return
  }
  for (const p of pieces) {
    if ('tex' in p) {
      const m = document.createElement('span')
      m.className = 'tq-math'
      renderMath(m, p.tex)
      target.appendChild(m)
    } else scriptText(target, p.text)
  }
}
export function applyInlineCss(e: HTMLElement, o: InlineOpts): void {
  if (o.fs) e.style.fontSize = `${o.fs}pt`
  if (o.fc) {
    const c = textColor(o.fc)
    if (c) e.style.color = c
  }
  if (o.ff) e.style.fontFamily = fontFamily(o.ff)
  if ('bold' in o) e.style.fontWeight = '700'
  if ('italic' in o) e.style.fontStyle = 'italic'
  const deco: string[] = []
  if ('underline' in o) deco.push('underline')
  if ('strike' in o) deco.push('line-through')
  if (deco.length > 0) e.style.textDecoration = deco.join(' ')
}

function richText(target: HTMLElement, text: string): void {
  const pieces = splitInline(text)
  if (!pieces.some((p) => 'opts' in p)) {
    richPlain(target, text)
    return
  }
  for (const p of pieces) {
    if ('opts' in p) {
      const sp = document.createElement('span')
      applyInlineCss(sp, p.opts)
      richPlain(sp, p.inner)
      target.appendChild(sp)
    } else richPlain(target, p.text)
  }
}

function fillText(target: HTMLElement, text: string, align: Style['align']): void {
  target.style.textAlign = align === 'distribute' ? 'left' : align
  if (align !== 'distribute') {
    richText(target, text)
    return
  }
  for (const line of plainInline(text).split('\n')) {
    const row = el('div', 'tq-dist')
    const chars = Array.from(line)
    if (chars.length <= 1) row.style.justifyContent = 'center'
    if (chars.length === 0) row.appendChild(el('span', undefined, '\u00a0'))
    for (const ch of chars) row.appendChild(el('span', undefined, ch === ' ' ? '\u00a0' : ch))
    target.appendChild(row)
  }
}

function tag(
  d: HTMLElement,
  o: 'v' | 'h',
  b: number,
  a1: number,
  a2: number,
  e: { kind: EdgeKind; color: string | null; w: number | null }
): void {
  d.dataset.o = o
  d.dataset.b = String(b)
  d.dataset.a1 = String(a1)
  d.dataset.a2 = String(a2)
  d.dataset.kind = e.kind
  d.dataset.w = e.w === null ? '' : String(e.w)
  d.dataset.c = e.color ?? ''
}

function build(n: TNode): HTMLElement {
  switch (n.k) {
    case 'block': {
      const d = el('div', 'tp-block')
      d.append(...renderBlocks([n.block]))
      return d
    }
    case 'line': {
      const kind: LineKind = n.kind
      return el('div', `tp-line tp-line-${kind}`)
    }
    case 'space': {
      const d = el('div', 'tp-space')
      d.style.height = `${n.n * 0.8}em`
      return d
    }
    case 'text': {
      const d = el('div', 'tp-text')
      if (n.line !== null) {
        d.dataset.tline = String(n.line)
        d.dataset.raw = n.raw
      }
      applyStyle(d, n.style)
      const bg = backColor(n.style.bg)
      if (bg) d.style.background = bg
      fillText(d, n.text, n.style.align)
      return d
    }
    case 'box': {
      const b = el('div', 'tp-box')
      for (const c of n.children) b.appendChild(build(c))
      return b
    }
    case 'table': {
      const t = el('table', 'tp-table')
      const headRow = el('tr')
      for (const c of n.columns) headRow.appendChild(el('th', undefined, c))
      t.appendChild(el('thead')).appendChild(headRow)
      const body = el('tbody')
      for (const r of n.rows) {
        const tr = el('tr')
        for (const c of r) tr.appendChild(el('td', undefined, c))
        body.appendChild(tr)
      }
      t.appendChild(body)
      return t
    }
    case 'grid': {
      const g = el('div', 'tq-grid')
      g.dataset.widths = JSON.stringify(n.widths)
      g.dataset.heights = JSON.stringify(n.heights)
      g.dataset.head = String(n.head)
      if (n.close !== null) g.dataset.close = String(n.close)
      g.dataset.cols = String(n.cols)
      const fixed = n.widths.reduce<number>((a, w) => a + (w ?? 0), 0)
      const free = n.widths.filter((w) => w === null).length
      const share = free > 0 ? Math.round((Math.max(0, PAPER_MM - fixed) / free) * 100) / 100 : 0
      g.style.gridTemplateColumns = n.widths.some((w) => w !== null)
        ? n.widths.map((w) => (w !== null ? `${Number(w)}mm` : `${share}mm`)).join(' ')
        : `repeat(${Number(n.cols)}, minmax(0, 1fr))`
      g.style.gridTemplateRows = n.heights.map((h) => `minmax(${Number(h)}mm, auto)`).join(' ')
      g.dataset.frame = n.frame
      g.dataset.frameW = n.frameW === null ? '' : String(n.frameW)
      g.dataset.frameC = n.frameC ?? ''
      g.style.border = n.frame === 'none' ? '0' : edgeCss(n.frame, n.frameC, n.frameW)
      const fw = n.frame === 'none' ? '0px' : edgeWidth(n.frame, n.frameW)
      if (n.frame === 'none') g.classList.add('tq-frame-none')
      const rows = n.heights.length

      const map: number[][] = Array.from({ length: rows }, () => Array<number>(n.cols).fill(-1))
      n.cells.forEach((c, i) => {
        for (let rr = c.r; rr < c.r + c.rs; rr++) {
          for (let cc = c.c; cc < c.c + c.cs; cc++) if (map[rr] && cc < n.cols) map[rr][cc] = i
        }
      })
      const edgeOf = (
        left: number,
        lSide: keyof Edges,
        right: number,
        rSide: keyof Edges,
        vertical: boolean
      ): { kind: EdgeKind; color: string | null; w: number | null } | null => {
        if (left < 0 || right < 0 || left === right) return null
        const A = n.cells[left]
        const B = n.cells[right]
        const a = A.style.set[lSide]
        const b = B.style.set[rSide]
        let kind: EdgeKind = 'solid'
        let src = B.ord >= A.ord ? B : A
        if (a !== undefined && b !== undefined) {
          const sa = vertical ? A.rs : A.cs
          const sb = vertical ? B.rs : B.cs
          src = sa !== sb ? (sa < sb ? A : B) : B.ord > A.ord ? B : A
          kind = src === B ? b : a
        } else if (a !== undefined) {
          kind = a
          src = A
        } else if (b !== undefined) {
          kind = b
          src = B
        }
        const side = src === A ? lSide : rSide
        const x = src.style.ex[side]
        return { kind, color: x?.c ?? src.style.ec, w: x?.w ?? null }
      }

      const outerExplicit = (i: number, side: 'l' | 'r' | 't' | 'b'): boolean => {
        if (i < 0) return false
        const k = n.cells[i]
        const touch =
          side === 'l'
            ? k.c === 0
            : side === 'r'
              ? k.c + k.cs === n.cols
              : side === 't'
                ? k.r === 0
                : k.r + k.rs === rows
        return touch && k.style.set[side] !== undefined
      }

      const reach = (
        d: HTMLElement,
        prop: 'marginLeft' | 'marginRight' | 'marginTop' | 'marginBottom'
      ): void => {
        if (fw === '0px') return
        d.style[prop] = `-${fw}`
        d.style.zIndex = '1'
      }

      n.cells.forEach((c) => {
        const s = c.style
        const d = el('div', `tq-cell${s.vertical ? ' tq-vertical' : ''}`)
        d.dataset.r = String(c.r)
        d.dataset.c = String(c.c)
        d.dataset.rs = String(c.rs)
        d.dataset.cs = String(c.cs)
        d.dataset.raw = c.raw
        if (c.src) {
          d.classList.add('tq-edit')
          d.dataset.def = String(c.src.def)
          d.dataset.end = String(c.src.end)
        } else if (n.endLine !== null) {
          d.dataset.gridEnd = String(n.endLine)
        }
        d.style.gridColumn = `${c.c + 1} / span ${c.cs}`
        d.style.gridRow = `${c.r + 1} / span ${c.rs}`
        d.style.alignItems = V_ITEMS[s.valign]
        applyStyle(d, s)
        const bg = backColor(s.bg)
        if (bg) d.style.background = bg
        if (s.p !== null) d.style.padding = `${s.p}pt`

        const t = el('div', 'tq-text')
        fillText(t, c.text, s.align)
        d.appendChild(t)
        if (s.dd || s.du) d.style.position = 'relative'
        if (s.dd) addDiag(d, 'down', s.dd)
        if (s.du) addDiag(d, 'up', s.du)
        if (s.dd) d.dataset.dd = `${s.dd.kind},${s.dd.w ?? ''},${s.dd.c ?? ''}`
        if (s.du) d.dataset.du = `${s.du.kind},${s.du.w ?? ''},${s.du.c ?? ''}`
        g.appendChild(d)
      })
      for (let r = 0; r < rows; r++) {
        for (let c = 1; c < n.cols; c++) {
          const e = edgeOf(map[r][c - 1], 'r', map[r][c], 'l', true)
          if (!e) continue
          const d = el('div', e.kind === 'none' ? 'tq-edge tq-guide' : 'tq-edge')
          d.style.gridColumn = String(c)
          d.style.gridRow = String(r + 1)
          d.style.justifySelf = 'end'
          d.style.width = '0'
          d.style.borderLeft = e.kind === 'none' ? GUIDE : edgeCss(e.kind, e.color, e.w)
          d.style.pointerEvents = 'none'
          if (r === 0 && (outerExplicit(map[r][c - 1], 't') || outerExplicit(map[r][c], 't')))
            reach(d, 'marginTop')
          if (
            r === rows - 1 &&
            (outerExplicit(map[r][c - 1], 'b') || outerExplicit(map[r][c], 'b'))
          )
            reach(d, 'marginBottom')
          tag(d, 'v', c, r, r, e)
          g.appendChild(d)
        }
      }
      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < n.cols; c++) {
          const e = edgeOf(map[r - 1][c], 'b', map[r][c], 't', false)
          if (!e) continue
          const d = el('div', e.kind === 'none' ? 'tq-edge tq-guide' : 'tq-edge')
          d.style.gridColumn = String(c + 1)
          d.style.gridRow = String(r)
          d.style.alignSelf = 'end'
          d.style.height = '0'
          d.style.borderTop = e.kind === 'none' ? GUIDE : edgeCss(e.kind, e.color, e.w)
          d.style.pointerEvents = 'none'
          if (c === 0 && (outerExplicit(map[r - 1][c], 'l') || outerExplicit(map[r][c], 'l')))
            reach(d, 'marginLeft')
          if (
            c === n.cols - 1 &&
            (outerExplicit(map[r - 1][c], 'r') || outerExplicit(map[r][c], 'r'))
          )
            reach(d, 'marginRight')
          tag(d, 'h', r, c, c, e)
          g.appendChild(d)
        }
      }

      const tagOuter = (
        d: HTMLElement,
        o: 'v' | 'h',
        b: number,
        a1: number,
        a2: number,
        e: { kind: EdgeKind; color: string | null; w: number | null }
      ): void => {
        tag(d, o, b, a1, a2, e)
        d.dataset.outer = '1'
      }
      for (const c of n.cells) {
        const s = c.style
        const sides: ('l' | 'r' | 't' | 'b')[] = []
        if (c.c === 0) sides.push('l')
        if (c.c + c.cs === n.cols) sides.push('r')
        if (c.r === 0) sides.push('t')
        if (c.r + c.rs === rows) sides.push('b')
        for (const side of sides) {
          const kind = s.set[side]
          if (kind === undefined) continue
          const x = s.ex[side]
          const e = { kind, color: x?.c ?? s.ec, w: x?.w ?? null }
          const vert = side === 'l' || side === 'r'
          const area = (d: HTMLElement): void => {
            if (vert) {
              d.style.gridColumn = side === 'l' ? '1' : String(n.cols)
              d.style.gridRow = `${c.r + 1} / span ${c.rs}`
              d.style.justifySelf = side === 'l' ? 'start' : 'end'
            } else {
              d.style.gridRow = side === 't' ? '1' : String(rows)
              d.style.gridColumn = `${c.c + 1} / span ${c.cs}`
              d.style.alignSelf = side === 't' ? 'start' : 'end'
            }
            d.style.pointerEvents = 'none'
          }
          const MARGIN = {
            l: 'marginLeft',
            r: 'marginRight',
            t: 'marginTop',
            b: 'marginBottom'
          } as const
          const BORDER = {
            l: 'borderLeft',
            r: 'borderRight',
            t: 'borderTop',
            b: 'borderBottom'
          } as const
          if (fw !== '0px') {
            const under = el('div', 'tq-edge')
            area(under)
            const cover = `calc(${fw} + 1px)`
            if (vert) under.style.width = cover
            else under.style.height = cover
            under.style[MARGIN[side]] = `calc(-1 * ${cover})`
            if (kind === 'none') {
              const none = (k: 'l' | 'r' | 't' | 'b'): boolean =>
                sides.includes(k) && s.set[k] === 'none'
              const [m1, k1, m2, k2] = vert
                ? (['marginTop', 't', 'marginBottom', 'b'] as const)
                : (['marginLeft', 'l', 'marginRight', 'r'] as const)
              if (none(k1)) under.style[m1] = `calc(-1 * ${cover})`
              if (none(k2)) under.style[m2] = `calc(-1 * ${cover})`
            }
            under.style.background = '#fff'
            g.appendChild(under)
          }
          const line = el('div', e.kind === 'none' ? 'tq-edge tq-guide' : 'tq-edge')
          area(line)
          if (vert) line.style.width = '0'
          else line.style.height = '0'
          const ew = e.kind === 'none' ? '1px' : edgeWidth(e.kind, e.w)
          const out = side === 'l' || side === 't' ? -1 : 1
          const axis = vert ? 'translateX' : 'translateY'
          line.style.transform =
            ew === fw
              ? `${axis}(${out * 100}%)`
              : `${axis}(calc(${out * 50}% + ${out} * ${fw} / 2))`
          line.style[BORDER[side]] = e.kind === 'none' ? GUIDE : edgeCss(e.kind, e.color, e.w)
          tagOuter(
            line,
            vert ? 'v' : 'h',
            side === 'l' || side === 't' ? 0 : vert ? n.cols : rows,
            vert ? c.r : c.c,
            vert ? c.r + c.rs - 1 : c.c + c.cs - 1,
            e
          )
          g.appendChild(line)
        }
      }
      return g
    }
  }
}

export function renderTemplate(spec: Ok): HTMLElement {
  const wrap = el('div', 'snote-template-wrap')
  const page = el('div', 'snote-page')
  applyStyle(page, spec.page)
  for (const n of spec.nodes) page.appendChild(build(n))
  wrap.appendChild(page)
  if (spec.warnings.length > 0) {
    const w = el('div', 'tp-warn')
    for (const msg of spec.warnings) w.appendChild(el('div', undefined, msg))
    wrap.appendChild(w)
  }
  return wrap
}
