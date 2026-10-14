import { addCellText, replaceCellText } from '../editor/templateEdit'
import { fillCell, mkScript, serializeCell } from '../view/cellInline'
import { enterMath, isMath, mathBeside, texOf } from '../view/cellMath'
import { renderMath } from '../view/mathText'
import type { Toolbar } from '../view/templateToolbar'
import { rcOf, whole, type GridSelection } from './gridSelection'

export const ZW = '\u200b'
export const ZWRE = /\u200b/g
export type CellEditorState = { editing: HTMLElement | null }

export function createCellEditor(opts: {
  gs: GridSelection
  toolbar: () => Toolbar | null
}): {
  state: CellEditorState
  spanOf: (n: Node | null) => HTMLElement | null
  caretIn: (node: Node, offset: number) => void
  leaveScript: (sp: HTMLElement) => void
  enterScript: (kind: 'sup' | 'sub') => void
  commit: () => void
  startEdit: (cell: HTMLElement, at?: { x: number; y: number }) => void
  moveTab: (from: { r: number; c: number; rs: number; cs: number }, dir: number) => void
} {
  const { gs, toolbar } = opts
  const { pickGrid, paint, size, cellAt, select } = gs
  const state: CellEditorState = { editing: null }

  const spanOf = (n: Node | null): HTMLElement | null => {
    const box = state.editing
    if (!box || !n || !box.contains(n)) return null
    const el = n instanceof Element ? n : n.parentElement
    const sp = el?.closest<HTMLElement>('[data-s]') ?? null
    return sp && box.contains(sp) ? sp : null
  }
  const caretIn = (node: Node, offset: number): void => {
    const s = window.getSelection()
    if (!s) return
    const r = document.createRange()
    r.setStart(node, offset)
    r.collapse(true)
    s.removeAllRanges()
    s.addRange(r)
  }
  const leaveScript = (sp: HTMLElement): void => {
    const after = document.createTextNode(ZW)
    if ((sp.textContent ?? '').replace(ZWRE, '') === '') sp.replaceWith(after)
    else sp.after(after)
    caretIn(after, 1)
  }
  const enterScript = (kind: 'sup' | 'sub'): void => {
    const s = window.getSelection()
    if (!s || s.rangeCount === 0) return
    const sp = mkScript(kind, ZW)
    s.getRangeAt(0).insertNode(sp)
    if (sp.firstChild) caretIn(sp.firstChild, 1)
  }

  const commit = (): void => {
    const box = state.editing
    if (!box) return
    state.editing = null
    toolbar()?.refresh()
    const cell = box.closest<HTMLElement>('.tq-cell')
    box.removeEventListener('keydown', onEditKey)
    box.removeEventListener('focusout', onFocusOut)
    const value = serializeCell(box)
    for (const mf of Array.from(box.querySelectorAll('math-field'))) {
      const t = isMath(mf) ? texOf(mf) : ''
      if (t) {
        const sp = document.createElement('span')
        sp.className = 'tq-math'
        renderMath(sp, t)
        mf.replaceWith(sp)
      } else mf.remove()
    }
    box.contentEditable = 'false'
    cell?.classList.remove('tq-editing')
    if (!cell || value === (cell.dataset.raw ?? '')) return
    if (cell.dataset.def !== undefined) {
      replaceCellText(Number(cell.dataset.def), Number(cell.dataset.end), value)
    } else if (cell.dataset.gridEnd !== undefined && value.trim() !== '') {
      const p = rcOf(cell)
      addCellText(Number(cell.dataset.gridEnd), p.r, p.c, p.rs, p.cs, value)
    }
  }

  const startEdit = (cell: HTMLElement, at?: { x: number; y: number }): void => {
    if (state.editing) commit()
    pickGrid(cell)
    const box = cell.querySelector<HTMLElement>('.tq-text')
    if (!box) return
    gs.state.sel = null
    paint()
    cell.classList.add('tq-editing')
    fillCell(box, cell.dataset.raw ?? '')
    box.contentEditable = 'plaintext-only'
    box.spellcheck = false
    state.editing = box
    toolbar()?.refresh()
    box.addEventListener('keydown', onEditKey)
    box.addEventListener('focusout', onFocusOut)
    box.focus()
    const s = window.getSelection()
    if (!s) return
    let placed = false
    if (at) {
      const d = document as Document & {
        caretPositionFromPoint?: (
          x: number,
          y: number
        ) => { offsetNode: Node; offset: number } | null
        caretRangeFromPoint?: (x: number, y: number) => Range | null
      }
      const cp = d.caretPositionFromPoint?.(at.x, at.y)
      const range = cp ? document.createRange() : (d.caretRangeFromPoint?.(at.x, at.y) ?? null)
      if (cp && range) {
        range.setStart(cp.offsetNode, cp.offset)
        range.collapse(true)
      }
      if (range && box.contains(range.startContainer)) {
        s.removeAllRanges()
        s.addRange(range)
        placed = true
      }
    }
    if (!placed) {
      const range = document.createRange()
      range.selectNodeContents(box)
      range.collapse(false)
      s.removeAllRanges()
      s.addRange(range)
    }
    if (at) {
      const hit = document.elementFromPoint(at.x, at.y)?.closest('math-field')
      if (isMath(hit)) enterMath(hit, 'end')
    }
  }

  const tabTarget = (
    from: { r: number; c: number; rs: number; cs: number },
    dir: number
  ): { r: number; c: number } | null => {
    const { rows, cols } = size()
    let r = from.r
    let c = dir > 0 ? from.c + from.cs : from.c - 1
    for (let guard = 0; guard < rows * cols + 2; guard++) {
      if (c >= cols) ((c = 0), r++)
      if (c < 0) ((c = cols - 1), r--)
      if (r < 0 || r >= rows) return null
      if (cellAt(r, c)) return { r, c }
      c += dir
    }
    return null
  }

  const moveTab = (from: { r: number; c: number; rs: number; cs: number }, dir: number): void => {
    const t = tabTarget(from, dir)
    const x = t && cellAt(t.r, t.c)
    if (x) startEdit(x)
  }

  function onFocusOut(e: FocusEvent): void {
    const to = e.relatedTarget as Node | null
    const box = state.editing
    if (to && box && (box.contains(to) || toolbar()?.el.contains(to))) return
    commit()
  }

  function onEditKey(e: KeyboardEvent): void {
    e.stopPropagation()
    if (e.isComposing) return
    if (
      (e.target as Element | null)?.closest?.('math-field') &&
      e.key !== 'Escape' &&
      e.key !== 'F5'
    )
      return
    if ((e.key === ' ' || e.key === 'Enter') && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const s0 = window.getSelection()
      const sp = s0 && s0.isCollapsed ? spanOf(s0.anchorNode) : null
      if (s0 && sp && s0.anchorNode) {
        const rr = document.createRange()
        rr.selectNodeContents(sp)
        rr.setStart(s0.anchorNode, s0.anchorOffset)
        if (rr.toString().replace(ZWRE, '') === '') leaveScript(sp)
      }
    }
    const box = e.currentTarget as HTMLElement
    const cell = box.closest<HTMLElement>('.tq-cell')
    if (!cell) return
    const p = rcOf(cell)
    if (e.key === 'Escape' || e.key === 'F5') {
      e.preventDefault()
      if (e.repeat) return
      const here = whole(cell)
      const viaF5 = e.key === 'F5'
      commit()
      window.setTimeout(() => {
        select(here)
        if (viaF5) gs.f5.whole = true
      }, 0)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const dir = e.shiftKey ? -1 : 1
      if (!tabTarget(p, dir)) return
      commit()
      window.setTimeout(() => moveTab(p, dir), 0)
    } else if (e.key.startsWith('Arrow') && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const near =
        e.key === 'ArrowRight'
          ? mathBeside(box, 1)
          : e.key === 'ArrowLeft'
            ? mathBeside(box, -1)
            : null
      if (near) {
        e.preventDefault()
        enterMath(near, e.key === 'ArrowRight' ? 'start' : 'end')
        return
      }
      const s = window.getSelection()
      if (!s || !s.isCollapsed || !s.anchorNode) return
      const full = box.innerText.replace(/\n$/, '').replace(ZWRE, '')
      const range = document.createRange()
      range.selectNodeContents(box)
      range.setEnd(s.anchorNode, s.anchorOffset)
      const off = range.toString().replace(ZWRE, '').length
      const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      const edge =
        (dx > 0 && off >= full.length) ||
        (dx < 0 && off <= 0) ||
        (dy > 0 && !full.slice(off).includes('\n')) ||
        (dy < 0 && !full.slice(0, off).includes('\n'))
      if (!edge) return
      e.preventDefault()
      const nr = dy > 0 ? p.r + p.rs : dy < 0 ? p.r - 1 : p.r
      const nc = dx > 0 ? p.c + p.cs : dx < 0 ? p.c - 1 : p.c
      const { rows, cols } = size()
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return
      commit()
      window.setTimeout(() => {
        const t = cellAt(nr, nc)
        if (t) startEdit(t)
      }, 0)
    }
  }

  return { state, spanOf, caretIn, leaveScript, enterScript, commit, startEdit, moveTab }
}

export type CellEditor = ReturnType<typeof createCellEditor>