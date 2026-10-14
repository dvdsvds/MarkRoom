import type { BorderKind, BorderWhere } from '../features/template/grid/gridEdit'
import type { EdgeRead, EdgeVal } from './templateRead'
import {
  button,
  dropdown,
  field,
  colorBar,
  diagSample,
  hintLine,
  lineSample,
  icon,
  INPUT_CSS,
  panel,
  type DropItem
} from './uiKit'

export interface BorderState {
  kind: BorderKind
  w: number | null
  c: string | null
}

const WIDTHS = ['0.1', '0.15', '0.2', '0.3', '0.4', '0.5', '0.7', '1', '1.5', '2', '3']
const COLORS: [string, string][] = [
  ['red', '빨강'],
  ['orange', '주황'],
  ['yellow', '노랑'],
  ['green', '초록'],
  ['blue', '파랑'],
  ['purple', '보라'],
  ['gray', '회색']
]

const FAINT = 'var(--tq-pv-off)'

const edgeIcon = (draw: string): string =>
  icon(
    `<rect x="2" y="2" width="12" height="12" stroke-opacity=".3" stroke-dasharray="2 2" stroke-width="1"/>${draw}`,
    12
  )
const GHOST = 'stroke-opacity=".35" stroke-dasharray="2 2" stroke-width="1"'
const FRAME_GHOST = `<rect x="2" y="2" width="12" height="12" ${GHOST}/>`
const CROSS_GHOST = `<path d="M8 2V14M2 8H14" ${GHOST}/>`
const ln = (x1: number, y1: number, x2: number, y2: number): string =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke-width="2"/>`
const FRAME = '<rect x="2" y="2" width="12" height="12" stroke-width="2"/>'
const CROSS = ln(8, 2, 8, 14) + ln(2, 8, 14, 8)

export function openBorderPanel(d: {
  st: BorderState
  borders: (where: BorderWhere) => boolean | void
  diagonal: (dir: 'down' | 'up') => boolean | void
  onClose: () => void
}): { box: HTMLElement; setEdges: (r: EdgeRead) => void } {
  const p = panel({ title: '테두리', top: '10%', onClose: d.onClose })

  const left = document.createElement('div')
  left.style.cssText = 'width:150px;display:flex;flex-direction:column;gap:12px'

  const mmPx = (mm: number): number => Math.max(1, mm * 3.78)
  const kindHtml = (k: BorderKind): string => lineSample(k, 1.5, 'full')
  const kind = dropdown({
    label: '',
    title: '종류',
    width: 120,
    block: true,
    items: () => [
      { text: '실선', value: 'solid', html: kindHtml('solid') },
      { text: '점선', value: 'dashed', html: kindHtml('dashed') },
      { text: '이중선', value: 'double', html: kindHtml('double') },
      { text: '대각선 ↘', value: 'diag-down', html: diagSample('down') },
      { text: '대각선 ↗', value: 'diag-up', html: diagSample('up') },
      { text: '없음', value: 'none', html: kindHtml('none') }
    ],
    pick: (v) => {
      if (v === 'diag-down' || v === 'diag-up') {
        d.diagonal(v === 'diag-down' ? 'down' : 'up')
        return
      }
      d.st.kind = (v ?? 'solid') as BorderKind
      kind.setHtml(kindHtml(d.st.kind))
    }
  })
  kind.setHtml(kindHtml(d.st.kind))

  const widthHtml = (w: number | null): string =>
    `<span style="min-width:54px">${w === null ? '기본' : `${w}mm`}</span>${lineSample('solid', mmPx(w ?? 0.12), 60)}`
  const width = dropdown({
    label: '',
    title: '굵기',
    width: 120,
    block: true,
    items: () => [
      { text: '기본', value: null, html: widthHtml(null) },
      ...WIDTHS.map((w): DropItem => ({ text: `${w}mm`, value: w, html: widthHtml(Number(w)) }))
    ],
    pick: (v) => {
      d.st.w = v === null ? null : Number(v)
      width.setHtml(widthHtml(d.st.w))
    }
  })
  width.setHtml(widthHtml(d.st.w))

  const colorHtml = (c: string | null, name = ''): string =>
    colorBar(c, name ? 56 : 'full') + (name ? `<span>${name}</span>` : '')
  const color = dropdown({
    label: '',
    title: '색',
    width: 120,
    block: true,
    items: () => [
      { text: '기본(검정)', value: null, html: colorHtml(null, '기본') },
      ...COLORS.map(([k, t]): DropItem => ({ text: t, value: k, html: colorHtml(k, t) }))
    ],
    pick: (v) => {
      d.st.c = v
      color.setHtml(colorHtml(d.st.c))
    }
  })
  color.setHtml(colorHtml(d.st.c))
  left.append(field('종류', kind.wrap), field('굵기', width.wrap), field('색', color.wrap))

  const right = document.createElement('div')
  const area = document.createElement('div')
  area.style.cssText = 'position:relative;width:184px;height:176px;margin:0 auto'
  const BX = 24,
    BY = 34,
    BW = 132,
    BH = 132
  const pv = document.createElement('div')
  pv.style.cssText = `position:absolute;left:${BX}px;top:${BY}px;width:${BW}px;height:${BH}px;box-sizing:border-box;border:1px solid var(--tq-pv-border);border-radius:2px`
  pv.innerHTML =
    `<div style="position:absolute;left:50%;top:0;bottom:0;border-left:1px dashed ${FAINT}"></div>` +
    `<div style="position:absolute;top:50%;left:0;right:0;border-top:1px dashed ${FAINT}"></div>`
  area.appendChild(pv)

  type PvSide = 'left' | 'right' | 'top' | 'bottom' | 'vmid' | 'hmid'
  const drawn = new Map<string, HTMLElement>()
  const inkOf = (c: string | null): string =>
    c ? (/^#/.test(c) ? c : `var(--c-${c})`) : 'var(--tq-text)'
  const SIDE_CSS: Record<PvSide, (b: string) => string> = {
    left: (b) => `left:-1px;top:-1px;bottom:-1px;border-left:${b}`,
    right: (b) => `right:-1px;top:-1px;bottom:-1px;border-right:${b}`,
    top: (b) => `top:-1px;left:-1px;right:-1px;border-top:${b}`,
    bottom: (b) => `bottom:-1px;left:-1px;right:-1px;border-bottom:${b}`,
    vmid: (b) => `left:50%;top:0;bottom:0;transform:translateX(-50%);border-left:${b}`,
    hmid: (b) => `top:50%;left:0;right:0;transform:translateY(-50%);border-top:${b}`
  }
  const widthPx = (v: EdgeVal): number => {
    if (v.w !== null) return Math.max(1, Math.min(5, v.w * 3.78))
    return v.kind === 'thick' || v.kind === 'double' ? 3 : 1
  }
  const clearDrawn = (): void => {
    for (const e of drawn.values()) e.remove()
    drawn.clear()
  }
  const drawSide = (side: PvSide, v: EdgeVal | 'mixed' | null | undefined): void => {
    if (!v || (v !== 'mixed' && v.kind === 'none')) return
    const css =
      v === 'mixed'
        ? `1px dotted var(--tq-text3)`
        : `${v.kind === 'double' ? Math.max(3, Math.round(widthPx(v))) : widthPx(v)}px ${v.kind === 'dashed' ? 'dashed' : v.kind === 'double' ? 'double' : 'solid'} ${inkOf(v.c)}`
    const e = document.createElement('div')
    e.style.cssText = `position:absolute;${SIDE_CSS[side](css)}`
    pv.appendChild(e)
    drawn.set(side, e)
  }
  const drawDiag = (dir: 'down' | 'up', v: EdgeVal | 'mixed' | null | undefined): void => {
    if (!v || (v !== 'mixed' && v.kind === 'none')) return
    const ns = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(ns, 'svg')
    svg.setAttribute('style', 'position:absolute;left:0;top:0;width:100%;height:100%')
    const line = (off: number, sw: number, dash: string): void => {
      const l = document.createElementNS(ns, 'line')
      l.setAttribute('x1', '0')
      l.setAttribute('x2', '100%')
      l.setAttribute('y1', dir === 'down' ? '0' : '100%')
      l.setAttribute('y2', dir === 'down' ? '100%' : '0')
      l.setAttribute('transform', `translate(0 ${off})`)
      l.setAttribute('stroke', v === 'mixed' ? 'var(--tq-text3)' : inkOf(v.c))
      l.setAttribute('stroke-width', String(sw))
      if (dash) l.setAttribute('stroke-dasharray', dash)
      svg.appendChild(l)
    }
    if (v === 'mixed') line(0, 1, '1 3')
    else if (v.kind === 'double') {
      line(-2, 1, '')
      line(2, 1, '')
    } else
      line(0, widthPx(v), v.kind === 'dashed' ? `${widthPx(v) * 3 + 2} ${widthPx(v) * 2 + 2}` : '')
    pv.appendChild(svg as unknown as HTMLElement)
    drawn.set(`d-${dir}`, svg as unknown as HTMLElement)
  }
  const setEdges = (r: EdgeRead): void => {
    clearDrawn()
    for (const s of ['left', 'right', 'top', 'bottom', 'vmid', 'hmid'] as const) drawSide(s, r[s])
    drawDiag('down', r.dd)
    drawDiag('up', r.du)
  }
  const act = (where: BorderWhere): void => {
    d.borders(where)
  }

  const place = (html: string, title: string, where: BorderWhere, cx: number, cy: number): void => {
    const b = button(html, title, () => act(where), {
      square: true,
      outline: true,
      css: 'width:18px;height:18px;border-radius:4px'
    })
    b.style.position = 'absolute'
    b.style.left = `${cx - 9}px`
    b.style.top = `${cy - 9}px`
    area.appendChild(b)
  }
  place(edgeIcon(ln(2, 2, 2, 14)), '왼쪽', 'left', BX, 16)
  place(edgeIcon(ln(8, 2, 8, 14)), '세로 가운데', 'vmid', BX + BW / 2, 16)
  place(edgeIcon(ln(14, 2, 14, 14)), '오른쪽', 'right', BX + BW, 16)
  const RX = BX + BW + 16
  place(edgeIcon(ln(2, 2, 14, 2)), '위쪽', 'top', RX, BY)
  place(edgeIcon(ln(2, 8, 14, 8)), '가로 가운데', 'hmid', RX, BY + BH / 2)
  place(edgeIcon(ln(2, 14, 14, 14)), '아래쪽', 'bottom', RX, BY + BH)
  right.appendChild(area)

  const row = (): HTMLElement => {
    const r = document.createElement('div')
    r.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:8px'
    return r
  }
  const tile = (inner: string, label: string, title: string, where: BorderWhere): HTMLElement => {
    const w = document.createElement('div')
    w.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;width:44px'
    const b = button(icon(inner, 18), title, () => act(where), {
      outline: true,
      css: 'width:30px;height:30px;padding:0'
    })
    const t = document.createElement('span')
    t.textContent = label
    t.style.cssText = 'font-size:12px;color:var(--tq-text2);cursor:pointer'
    t.addEventListener('click', () => act(where))
    w.append(b, t)
    return w
  }
  const r1 = row()
  r1.style.justifyContent = 'center'
  r1.style.gap = '4px'
  r1.append(
    tile(FRAME + CROSS, '모두', '모두 (바깥쪽 + 안쪽)', 'all'),
    tile(FRAME + CROSS_GHOST, '바깥쪽', '바깥쪽', 'outer'),
    tile(CROSS + FRAME_GHOST, '안쪽', '안쪽', 'inner')
  )
  right.append(r1)

  const body = p.body
  body.style.cssText += ';display:flex;gap:22px'
  body.append(left, right)
  p.foot.appendChild(hintLine([{ key: 'L' }, ' 또는 ', { key: 'Esc' }, ' 닫기']))
  document.body.appendChild(p.box)
  return { box: p.box, setEdges }
}

export function openSplitPanel(d: {
  onOk: (cols: number, rows: number) => boolean
  onClose?: () => void
}): HTMLElement {
  const close = (): void => {
    p.box.remove()
    d.onClose?.()
  }
  const p = panel({ title: '칸 나누기', top: '28%', onClose: close })
  const num = (value: string, max: number): HTMLInputElement => {
    const i = document.createElement('input')
    i.type = 'number'
    i.min = '1'
    i.max = String(max)
    i.value = value
    i.style.cssText = `${INPUT_CSS};width:84px;user-select:text`
    i.addEventListener('focus', () => (i.style.borderColor = 'var(--tq-accent)'))
    i.addEventListener('blur', () => (i.style.borderColor = 'var(--tq-field-border)'))
    return i
  }
  const ci = num('2', 100)
  const ri = num('1', 200)
  const rowEl = document.createElement('div')
  rowEl.style.cssText = 'display:flex;gap:14px'
  rowEl.append(field('칸 수 (가로)', ci), field('줄 수 (세로)', ri))
  p.body.appendChild(rowEl)

  const ok = (): void => {
    if (d.onOk(Math.floor(Number(ci.value)), Math.floor(Number(ri.value)))) close()
  }
  p.foot.style.cssText += ';display:flex;align-items:center;justify-content:space-between;gap:12px'
  const btns = document.createElement('div')
  btns.style.cssText = 'display:flex;gap:6px'
  btns.append(
    button('취소', '취소 (Esc)', close, { outline: true }),
    button('확인', '확인 (Enter)', ok, { primary: true })
  )
  p.foot.append(hintLine([{ key: 'Enter' }, ' 확인 · ', { key: 'Esc' }, ' 취소']), btns)

  p.box.addEventListener('keydown', (ev) => {
    ev.stopPropagation()
    if (ev.key === 'Enter') {
      ev.preventDefault()
      ok()
    } else if (ev.key === 'Escape') {
      ev.preventDefault()
      close()
    }
  })
  document.body.appendChild(p.box)
  ci.focus()
  ci.select()
  return p.box
}
