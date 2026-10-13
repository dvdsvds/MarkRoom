import { applyGridEdit } from '../../editor/templateEdit'
import { dragColWidths, setColWidths, setRowHeight, type GridInfo } from '../gridEdit'
import { toast } from '../uiKit'
import type { CellEditor } from './cellEditor'
import { rcOf, whole, type GridSelection } from './gridSelection'

type Hit = { g: HTMLElement; kind: 'col' | 'row'; idx: number }
const PX_MM = 96 / 25.4

export function createGridMouse(opts: {
  el: HTMLElement
  grid: () => HTMLElement | null
  editMode: { current: boolean }
  gs: GridSelection
  ed: CellEditor
}): {
  onDown: (e: MouseEvent) => void
  onMove: (e: MouseEvent) => void
  onUp: (e: MouseEvent) => void
  onHover: (e: MouseEvent) => void
  onResizeDown: (e: MouseEvent) => void
  onResizeMove: (e: MouseEvent) => void
  onResizeUp: () => void
} {
  const { el, grid, editMode, gs, ed } = opts
  let drag: { r: number; c: number; moved: boolean } | null = null
  let rz: {
    hit: Hit
    info: GridInfo
    start: number
    rect: DOMRect
    rowsPx: number[]
    saveCols: string
    saveRows: string
    list: number[] | null
    h: number | null
  } | null = null

  const cellOf = (t: EventTarget | null): HTMLElement | null => {
    const x = t instanceof Element ? t.closest<HTMLElement>('.tq-cell') : null
    return x && grid()?.contains(x) ? x : null
  }

  const onDown = (e: MouseEvent): void => {
    if (!editMode.current || e.button !== 0) return
    const x = cellOf(e.target)
    if (!x) return
    gs.pickGrid(x)
    if (x.classList.contains('tq-editing') && !e.shiftKey) return
    const p = rcOf(x)
    if (e.shiftKey) {
      e.preventDefault()
      if (ed.state.editing) ed.commit()
      const cur = gs.state.sel ?? whole(x)
      gs.select({
        r1: Math.min(cur.r1, p.r),
        c1: Math.min(cur.c1, p.c),
        r2: Math.max(cur.r2, p.r + p.rs - 1),
        c2: Math.max(cur.c2, p.c + p.cs - 1)
      })
    }
    drag = { r: p.r, c: p.c, moved: false }
  }

  const onMove = (e: MouseEvent): void => {
    if (!drag || !(e.buttons & 1)) return
    const x = cellOf(e.target)
    if (!x) return
    const p = rcOf(x)
    const ge = gs.gridEl()
    if (ge && !ge.contains(x)) return
    if (p.r === drag.r && p.c === drag.c && !drag.moved && !gs.state.sel) return
    drag.moved = true
    e.preventDefault()
    if (ed.state.editing) ed.commit()
    window.getSelection()?.removeAllRanges()
    gs.select(
      {
        r1: Math.min(drag.r, p.r),
        c1: Math.min(drag.c, p.c),
        r2: Math.max(drag.r, p.r + p.rs - 1),
        c2: Math.max(drag.c, p.c + p.cs - 1)
      },
      { r: drag.r, c: drag.c },
      { r: p.r, c: p.c }
    )
  }

  const onUp = (e: MouseEvent): void => {
    const d = drag
    drag = null
    if (!editMode.current || !d || d.moved || gs.state.sel) return
    const x = cellOf(e.target)
    if (!x || x.classList.contains('tq-editing')) return
    ed.startEdit(x, { x: e.clientX, y: e.clientY })
  }

  const trackPx = (g: HTMLElement, rows: boolean): number[] =>
    (rows ? getComputedStyle(g).gridTemplateRows : getComputedStyle(g).gridTemplateColumns)
      .split(' ')
      .map(parseFloat)
      .filter((n) => Number.isFinite(n))

  const hitTest = (e: MouseEvent): Hit | null => {
    const t = e.target instanceof Element ? e.target.closest<HTMLElement>('.tq-grid') : null
    if (!t || !grid()?.contains(t)) return null
    const r = t.getBoundingClientRect()
    const cols = trackPx(t, false)
    const rows = trackPx(t, true)
    const sc = cols.reduce((a, b) => a + b, 0)
    const sr = rows.reduce((a, b) => a + b, 0)
    if (sc <= 0 || sr <= 0) return null
    const TOL = 4
    let acc = 0
    for (let k = 0; k < cols.length - 1; k++) {
      acc += cols[k]
      if (Math.abs(e.clientX - (r.left + (acc / sc) * r.width)) <= TOL)
        return { g: t, kind: 'col', idx: k }
    }
    acc = 0
    for (let k = 0; k < rows.length; k++) {
      acc += rows[k]
      if (Math.abs(e.clientY - (r.top + (acc / sr) * r.height)) <= TOL)
        return { g: t, kind: 'row', idx: k }
    }
    return null
  }

  const onHover = (e: MouseEvent): void => {
    if (!editMode.current || rz) return
    for (const x of Array.from(el.querySelectorAll('.tq-hot-col, .tq-hot-row'))) {
      x.classList.remove('tq-hot-col', 'tq-hot-row')
    }
    if (drag || e.buttons & 1) return
    const h = hitTest(e)
    if (h) h.g.classList.add(h.kind === 'col' ? 'tq-hot-col' : 'tq-hot-row')
  }

  const onResizeDown = (e: MouseEvent): void => {
    if (!editMode.current || e.button !== 0) return
    const hit = hitTest(e)
    if (!hit) return
    e.preventDefault()
    e.stopPropagation()
    if (ed.state.editing) ed.commit()
    gs.pickGrid(hit.g)
    const info = gs.gridInfo()
    if (!info) return
    rz = {
      hit,
      info,
      start: hit.kind === 'col' ? e.clientX : e.clientY,
      rect: hit.g.getBoundingClientRect(),
      rowsPx: trackPx(hit.g, true),
      saveCols: hit.g.style.gridTemplateColumns,
      saveRows: hit.g.style.gridTemplateRows,
      list: null,
      h: null
    }
  }

  const onResizeMove = (e: MouseEvent): void => {
    if (!rz) return
    e.preventDefault()
    const { hit, info, rect } = rz
    if (hit.kind === 'col') {
      const base = dragColWidths(info, hit.idx, 0)
      if (!base) return
      const total = base.reduce((a, b) => a + b, 0)
      const list = dragColWidths(info, hit.idx, ((e.clientX - rz.start) / rect.width) * total)
      if (!list) return
      rz.list = list
      hit.g.style.gridTemplateColumns = list.map((v) => `${v}mm`).join(' ')
    } else {
      const sum = rz.rowsPx.reduce((a, b) => a + b, 0)
      const dmm = ((e.clientY - rz.start) * sum) / rect.height / PX_MM
      const h = Math.max(3, Math.round((rz.rowsPx[hit.idx] / PX_MM + dmm) * 2) / 2)
      rz.h = h
      hit.g.style.gridTemplateRows = rz.rowsPx
        .map((px, i) => (i === hit.idx ? `minmax(${h}mm, auto)` : `${px}px`))
        .join(' ')
    }
  }

  const onResizeUp = (): void => {
    const s = rz
    rz = null
    if (!s) return
    const { hit, info } = s
    const undoStyle = (): void => {
      hit.g.style.gridTemplateColumns = s.saveCols
      hit.g.style.gridTemplateRows = s.saveRows
    }
    let err: string | null = null
    if (hit.kind === 'col') {
      const base = dragColWidths(info, hit.idx, 0)
      if (!s.list || !base || s.list.every((v, i) => v === base[i])) {
        undoStyle()
        return
      }
      const list = s.list
      err = applyGridEdit((getLine) => setColWidths(info, list, getLine))
    } else {
      if (s.h === null || Math.abs(s.h - s.rowsPx[hit.idx] / PX_MM) < 0.25) {
        undoStyle()
        return
      }
      const h = s.h
      err = applyGridEdit((getLine) => setRowHeight(info, hit.idx, h, getLine))
    }
    if (err) {
      toast(err)
      undoStyle()
    }
  }

  return { onDown, onMove, onUp, onHover, onResizeDown, onResizeMove, onResizeUp }
}