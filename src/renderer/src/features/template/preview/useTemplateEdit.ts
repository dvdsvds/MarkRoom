import { useEffect, type MutableRefObject, type RefObject } from 'react'
import type { Toolbar } from '../../../components/templateToolbar'
import { createBorderPanel } from './borderPanel'
import { createCellEditor } from './cellEditor'
import { createGridKeys } from './gridKeys'
import { createGridMouse } from './gridMouse'
import { createGridSelection } from './gridSelection'
import { createTextEditor } from './textEditor'
import { createToolbarBridge } from './toolbarBridge'

export function useTemplateEdit(
  containerRef: RefObject<HTMLDivElement | null>,
  editIdxRef: MutableRefObject<number | null>,
  editModeRef: MutableRefObject<boolean>
): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let toolbar: Toolbar | null = null
    const grid = (): HTMLElement | null =>
      editIdxRef.current === null
        ? null
        : (Array.from(el.querySelectorAll<HTMLElement>('.snote-template-wrap'))[
            editIdxRef.current
          ] ?? null)

    const onceRendered = (fn: () => void): void => {
      const h = (): void => {
        el.removeEventListener('snote-rendered', h)
        fn()
      }
      el.addEventListener('snote-rendered', h)
    }

    let bp: ReturnType<typeof createBorderPanel> | null = null
    const gs = createGridSelection({
      el,
      grid,
      onPaint: () => {
        toolbar?.refresh()
        bp?.refresh()
      }
    })
    const { cellAt, paint, normalize } = gs
    const ed = createCellEditor({ gs, toolbar: () => toolbar })
    const tx = createTextEditor({
      el,
      toolbar: () => toolbar,
      onceRendered,
      editMode: editModeRef
    })
    const onTextClick = tx.onTextClick
    const gm = createGridMouse({ el, grid, editMode: editModeRef, gs, ed })
    const border = createBorderPanel({ gs })
    bp = border
    const { onKey } = createGridKeys({ gs, ed, border, editMode: editModeRef })
    const { onDown, onMove, onUp, onHover, onResizeDown, onResizeMove, onResizeUp } = gm

    const restore = (): void => {
      const keep = gs.state.sel
      ed.state.editing = null
      gs.state.sel = keep && cellAt(keep.r1, keep.c1) ? normalize(keep) : null
      paint()
    }

    const bridge = createToolbarBridge({
      el,
      grid,
      editMode: editModeRef,
      gs,
      ed,
      tx,
      onceRendered
    })
    toolbar = bridge.toolbar
    const { mountBar, onSel } = bridge
    mountBar()

    el.addEventListener('snote-rendered', mountBar)
    el.addEventListener('snote-editmode', mountBar)
    document.addEventListener('selectionchange', onSel)
    const resetPageScroll = (): void => {
      const root = document.scrollingElement
      if (root && root.scrollTop !== 0) root.scrollTop = 0
    }
    window.addEventListener('scroll', resetPageScroll)
    el.addEventListener('mousedown', onResizeDown, true)
    el.addEventListener('mousemove', onHover)
    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', onResizeUp)
    el.addEventListener('mousedown', onDown)
    el.addEventListener('click', onTextClick)
    el.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey, true)
    el.addEventListener('snote-rendered', restore)
    return () => {
      el.removeEventListener('click', onTextClick)
      el.removeEventListener('mousedown', onDown)
      el.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', resetPageScroll)
      bp?.close()
      el.removeEventListener('mousedown', onResizeDown, true)
      el.removeEventListener('mousemove', onHover)
      window.removeEventListener('mousemove', onResizeMove)
      window.removeEventListener('mouseup', onResizeUp)
      el.removeEventListener('snote-rendered', restore)
      el.removeEventListener('snote-rendered', mountBar)
      el.removeEventListener('snote-editmode', mountBar)
      document.removeEventListener('selectionchange', onSel)
      toolbar?.el.remove()
    }
  }, [containerRef, editIdxRef, editModeRef])
}