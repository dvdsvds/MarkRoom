import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { markdownRenderer } from '../markdown/renderMarkdown'
import { useCodeRun } from './preview/useCodeRun'
import { useImageMinWidth } from './preview/useImageMinWidth'
import { useScrollSync } from './preview/useScrollSync'
import { useClickHandlers } from './preview/useClickHandlers'
import { useMermaid } from './preview/useMermaid'
import { useCodeDecorations } from './preview/useCodeDecorations'
import { useOutputBlocks } from './preview/useOutputBlocks'
import { useTemplateRender } from './preview/useTemplateRender'
import { createGridSelection } from './preview/gridSelection'
import { createCellEditor } from './preview/cellEditor'
import { createTextEditor } from './preview/textEditor'
import { createGridMouse } from './preview/gridMouse'
import { createBorderPanel } from './preview/borderPanel'
import { createGridKeys } from './preview/gridKeys'
import type { Toolbar } from './templateToolbar'
import { createToolbarBridge } from './preview/toolbarBridge'

export interface MarkdownPreviewHandle {
  scrollToRatio: (ratio: number) => void
}

interface MarkdownPreviewProps {
  source: string
  baseDir?: string
  onScrollRatio?: (ratio: number) => void
  onWikilinkClick?: (title: string) => void
  onToggleTask?: (line: number) => void
  onReplaceSource?: (next: string) => void
  onMinWidthChange?: (px: number) => void
  onHasTemplateChange?: (has: boolean) => void
  className?: string
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview(
    {
      source,
      baseDir,
      onScrollRatio,
      onWikilinkClick,
      onToggleTask,
      onReplaceSource,
      onMinWidthChange,
      onHasTemplateChange,
      className
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const onReplaceSourceRef = useRef(onReplaceSource)
    const sourceRef = useRef(source)
    const editIdxRef = useRef<number | null>(null)
    const editModeRef = useRef(false)

    useEffect(() => {
      onReplaceSourceRef.current = onReplaceSource
      sourceRef.current = source
    })

    const html = useMemo(() => markdownRenderer.render(source, baseDir), [source, baseDir])
    useImageMinWidth(containerRef, html, onMinWidthChange)
    useScrollSync(containerRef, ref, onScrollRatio)
    useClickHandlers(containerRef, onWikilinkClick, onToggleTask)

    const onHasTemplateChangeRef = useRef(onHasTemplateChange)

    useEffect(() => {
      onHasTemplateChangeRef.current = onHasTemplateChange
    }, [onHasTemplateChange])

    useEffect(() => {
      onHasTemplateChangeRef.current?.(html.includes('snote-template'))
    }, [html])

    useMermaid(containerRef, html)
    useCodeDecorations(containerRef, html)
    useOutputBlocks(containerRef, html)
    useTemplateRender(containerRef, html, editIdxRef, editModeRef)
    useCodeRun(containerRef, html, baseDir, sourceRef, onReplaceSourceRef)

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
        onceRendered: (fn) => onceRendered(fn),
        editMode: editModeRef
      })
      const onTextClick = tx.onTextClick
      const gm = createGridMouse({ el, grid, editMode: editModeRef, gs, ed })
      const border = createBorderPanel({ gs })
      bp = border
      const { onKey } = createGridKeys({ gs, ed, border, editMode: editModeRef })
      const { onDown, onMove, onUp, onHover, onResizeDown, onResizeMove, onResizeUp } = gm

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

      const restore = (): void => {
        const keep = gs.state.sel
        ed.state.editing = null
        gs.state.sel = keep && cellAt(keep.r1, keep.c1) ? normalize(keep) : null
        paint()
      }

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
    }, [])

    return (
      <div
        ref={containerRef}
        className={`prose-preview ${className ?? ''}`}
        style={{
          fontFamily: 'var(--font-preview)',
          fontSize: 'var(--preview-font-size)',
          lineHeight: 'var(--preview-line-height)'
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
)