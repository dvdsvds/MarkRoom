import type { EdgeKind, LineKind, ParsedTemplate, Style, TNode } from '../markdown/templatePlugin'
import { fontCandidates } from '../utils/systemFonts'

type Ok = Exclude<ParsedTemplate, { error: string }>

const NAMED = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const SERIF_RE = /바탕|명조|궁서|batang|myeongjo|myungjo|serif|times|georgia|garamond|palatino|gungsuh/i
const PAPER_MM = 186
const V_ITEMS = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const

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

function edgeCss(kind: EdgeKind, color: string | null): string {
  if (kind === 'none') return '0'
  const w = kind === 'thick' || kind === 'double' ? '3px' : '1px'
  const st = kind === 'dashed' ? 'dashed' : kind === 'double' ? 'double' : 'solid'
  return `${w} ${st} ${textColor(color) ?? 'var(--tp-ink)'}`
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

/** 배분 정렬은 글자마다 칸을 나눠서 양 끝 사이에 고르게 벌린다. */
function fillText(target: HTMLElement, text: string, align: Style['align']): void {
  target.style.textAlign = align === 'distribute' ? 'left' : align
  if (align !== 'distribute') {
    target.textContent = text
    return
  }
  for (const line of text.split('\n')) {
    const row = el('div', 'tq-dist')
    const chars = Array.from(line)
    if (chars.length <= 1) row.style.justifyContent = 'center'
    if (chars.length === 0) row.appendChild(el('span', undefined, '\u00a0'))
    for (const ch of chars) row.appendChild(el('span', undefined, ch === ' ' ? '\u00a0' : ch))
    target.appendChild(row)
  }
}

function build(n: TNode): HTMLElement {
  switch (n.k) {
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
      const fixed = n.widths.reduce<number>((a, w) => a + (w ?? 0), 0)
      const free = n.widths.filter((w) => w === null).length
      const share = free > 0 ? Math.round((Math.max(0, PAPER_MM - fixed) / free) * 100) / 100 : 0
      g.style.gridTemplateColumns = n.widths.some((w) => w !== null)
        ? n.widths.map((w) => (w !== null ? `${Number(w)}mm` : `${share}mm`)).join(' ')
        : `repeat(${Number(n.cols)}, minmax(0, 1fr))`
      g.style.gridTemplateRows = n.heights.map((h) => `minmax(${Number(h)}mm, auto)`).join(' ')
      g.style.border = n.frame === 'none' ? '0' : edgeCss(n.frame, null)
      const rows = n.heights.length

      const map: number[][] = Array.from({ length: rows }, () => Array<number>(n.cols).fill(-1))
      n.cells.forEach((c, i) => {
        for (let rr = c.r; rr < c.r + c.rs; rr++) {
          for (let cc = c.c; cc < c.c + c.cs; cc++) if (map[rr] && cc < n.cols) map[rr][cc] = i
        }
      })
      const winner = (i: number, others: number[]): number =>
        others.reduce((a, j) => (n.cells[j].ord > n.cells[a].ord ? j : a), i)

      n.cells.forEach((c, i) => {
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

        if (c.c + c.cs < n.cols) {
          const nb = new Set<number>()
          for (let rr = c.r; rr < c.r + c.rs; rr++) nb.add(map[rr][c.c + c.cs])
          const others = [...nb].filter((j) => j >= 0 && j !== i)
          const w = winner(i, others)
          const ws = n.cells[w].style
          d.style.borderRight = edgeCss(w === i ? ws.edges.r : ws.edges.l, ws.ec)
        }
        if (c.r + c.rs < rows) {
          const nb = new Set<number>()
          for (let cc = c.c; cc < c.c + c.cs; cc++) nb.add(map[c.r + c.rs][cc])
          const others = [...nb].filter((j) => j >= 0 && j !== i)
          const w = winner(i, others)
          const ws = n.cells[w].style
          d.style.borderBottom = edgeCss(w === i ? ws.edges.b : ws.edges.t, ws.ec)
        }

        const t = el('div', 'tq-text')
        fillText(t, c.text, s.align)
        d.appendChild(t)
        g.appendChild(d)
      })
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