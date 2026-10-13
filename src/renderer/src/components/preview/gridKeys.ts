import { applyGridEdit } from '@renderer/editor/templateEdit'
import { redoEditor, undoEditor } from '../../editor/MarkdownEditor'
import {
  deleteCols,
  deleteRows,
  insertCols,
  insertRows,
  mergeGrid,
  splitGrid,
  type GridInfo,
  type GridResult,
  type Rect
} from '../gridEdit'
import { openSplitPanel } from '../templatePanels'
import { toast } from '../uiKit'
import type { BorderPanel } from './borderPanel'
import type { CellEditor } from './cellEditor'
import { rcOf, whole, type GridSelection } from './gridSelection'

export function createGridKeys(opts: {
  gs: GridSelection
  ed: CellEditor
  border: BorderPanel
  editMode: { current: boolean }
}): { onKey: (e: KeyboardEvent) => void } {
  const { gs, ed, border, editMode } = opts
  const { gridInfo, normalize, select, cellAt, size } = gs

  const doMerge = (): void => {
    const info = gridInfo()
    const sel = gs.state.sel
    if (!info || !sel) return
    const rect: Rect = normalize(sel)
    const err = applyGridEdit((getLine) => mergeGrid(info, rect, getLine))
    if (err) toast(err)
    else select(null)
  }

  const askSplit = (): void => {
    const info = gridInfo()
    const sel = gs.state.sel
    if (!info || !sel) return
    const rect: Rect = normalize(sel)
    openSplitPanel({
      onOk: (n, m) => {
        if (!(n >= 1) || !(m >= 1) || n * m < 2) {
          toast('나눌 칸 수와 줄 수를 확인해 주세요')
          return false
        }
        const err = applyGridEdit((getLine) => splitGrid(info, rect, n, m, getLine))
        if (err) toast(err)
        else select(null)
        return true
      }
    })
  }

  const doEdit = (
    fn: (info: GridInfo, rect: Rect, getLine: (n: number) => string) => GridResult
  ): void => {
    const info = gridInfo()
    const sel = gs.state.sel
    if (!info || !sel) return
    const rect: Rect = normalize(sel)
    const err = applyGridEdit((getLine) => fn(info, rect, getLine))
    if (err) toast(err)
    else select(null)
  }

  const onKey = (e: KeyboardEvent): void => {
    const { sel, head, anchor } = gs.state
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if ((e.target as Element | null)?.closest?.('math-field')) return
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase()
      if (k === 'z' || k === 'y') {
        e.preventDefault()
        if (k === 'y' || e.shiftKey) redoEditor()
        else undoEditor()
        return
      }
    }
    const target = e.target as HTMLElement | null
    if (target?.closest('.cm-editor')) return
    if (e.key === 'Escape' && border.isOpen()) {
      e.preventDefault()
      border.close()
      return
    }
    if (e.key === 'F5') {
      e.preventDefault()
      if (e.repeat) return
      if (!sel) return
      const { rows, cols } = size()
      if (gs.f5.whole) {
        select({ r1: 0, c1: 0, r2: rows - 1, c2: cols - 1 })
      } else {
        const x = cellAt(sel.r1, sel.c1)
        if (x) select(whole(x))
        gs.f5.whole = true
      }
      return
    }
    if (!sel) return
    if (editMode.current && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
      if (e.code === 'KeyM') {
        e.preventDefault()
        doMerge()
        return
      }
      if (e.code === 'KeyS') {
        e.preventDefault()
        askSplit()
        return
      }
    }
    if (editMode.current && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const alt = e.shiftKey
      if (e.code === 'KeyL' && !alt) {
        e.preventDefault()
        border.toggle()
        return
      }
      if (e.code === 'KeyR') {
        e.preventDefault()
        doEdit((i, r, g) => insertRows(i, r, !alt, g))
        return
      }
      if (e.code === 'KeyC') {
        e.preventDefault()
        doEdit((i, r, g) => insertCols(i, r, !alt, g))
        return
      }
      if (e.code === 'KeyX') {
        e.preventDefault()
        doEdit((i, r, g) => (alt ? deleteCols(i, r, g) : deleteRows(i, r, g)))
        return
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      select(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const x = cellAt(sel.r1, sel.c1)
      if (x) ed.moveTab(rcOf(x), e.shiftKey ? -1 : 1)
    } else if (e.key.startsWith('Arrow') && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      const { rows, cols } = size()
      if (!e.shiftKey) {
        const all = sel.r1 === 0 && sel.c1 === 0 && sel.r2 === rows - 1 && sel.c2 === cols - 1
        if (all) return
        const base = head ?? { r: sel.r1, c: sel.c1 }
        const from = cellAt(base.r, base.c)
        if (!from) return
        const p = rcOf(from)
        const dx = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        const dy = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
        const nr = dy > 0 ? p.r + p.rs : dy < 0 ? p.r - 1 : p.r
        const nc = dx > 0 ? p.c + p.cs : dx < 0 ? p.c - 1 : p.c
        const next = nr >= 0 && nc >= 0 && nr < rows && nc < cols ? cellAt(nr, nc) : null
        if (next) select(whole(next))
        return
      }
      const a = anchor ?? { r: sel.r1, c: sel.c1 }
      const h = { ...(head ?? { r: sel.r2, c: sel.c2 }) }
      if (e.key === 'ArrowRight') h.c = Math.min(cols - 1, h.c + 1)
      else if (e.key === 'ArrowLeft') h.c = Math.max(0, h.c - 1)
      else if (e.key === 'ArrowDown') h.r = Math.min(rows - 1, h.r + 1)
      else h.r = Math.max(0, h.r - 1)
      select(
        {
          r1: Math.min(a.r, h.r),
          c1: Math.min(a.c, h.c),
          r2: Math.max(a.r, h.r),
          c2: Math.max(a.c, h.c)
        },
        a,
        h
      )
    }
  }

  return { onKey }
}