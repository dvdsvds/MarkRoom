import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { markdownRenderer } from '../markdown/renderMarkdown'
import { applyGridEdit, readGrid } from '../editor/MarkdownEditor'
import { createToolbar, type Toolbar } from './templateToolbar'
import { readCellOpts, setCellOpts, type CellOptChange } from './gridEdit'
import { toast } from './uiKit'
import {
  applyCaret,
  applyInline,
  inlineAt,
  mkScript,
  serializeCell,
  styleScript,
  textChangeOf,
  type TextChange
} from './cellInline'
import { useCodeRun } from './preview/useCodeRun'
import { useImageMinWidth } from './preview/useImageMinWidth'
import { useScrollSync } from './preview/useScrollSync'
import { useClickHandlers } from './preview/useClickHandlers'
import { useMermaid } from './preview/useMermaid'
import { useCodeDecorations } from './preview/useCodeDecorations'
import { useOutputBlocks } from './preview/useOutputBlocks'
import { useTemplateRender } from './preview/useTemplateRender'
import { createGridSelection, rcOf, whole, type Sel } from './preview/gridSelection'
import { createCellEditor, ZWRE } from './preview/cellEditor'
import { createTextEditor } from './preview/textEditor'
import { createGridMouse } from './preview/gridMouse'
import { createBorderPanel } from './preview/borderPanel'
import { createGridKeys } from './preview/gridKeys'

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

      let bp: ReturnType<typeof createBorderPanel> | null = null
      const gs = createGridSelection({
        el,
        grid,
        onPaint: () => {
          toolbar?.refresh()
          bp?.refresh()
        }
      })

      const { cells, cellAt, paint, normalize, gridInfo } = gs
      const ed = createCellEditor({ gs, toolbar: () => toolbar })
      const { spanOf, caretIn, leaveScript, enterScript, commit, startEdit } = ed
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

      const restore = (): void => {
        const keep = gs.state.sel
        ed.state.editing = null
        gs.state.sel = keep && cellAt(keep.r1, keep.c1) ? normalize(keep) : null
        paint()
      }

      const targetRect = (): Sel | null => {
        const sel = gs.state.sel
        if (sel) return normalize(sel)
        const c = ed.state.editing?.closest<HTMLElement>('.tq-cell')
        return c ? whole(c) : null
      }

      const onceRendered = (fn: () => void): void => {
        const h = (): void => {
          el.removeEventListener('snote-rendered', h)
          fn()
        }
        el.addEventListener('snote-rendered', h)
      }
      const runCell = (t: Sel, ch: CellOptChange): boolean => {
        const info = gridInfo()
        if (!info) return false
        const err = applyGridEdit((getLine) => setCellOpts(info, t, ch, getLine))
        if (err) toast(err)
        return !err
      }
      let lastRange: Range | null = null
      const curRange = (): Range | null => {
        const box = ed.state.editing
        if (!box) return null
        const s = window.getSelection()
        if (s && s.rangeCount > 0 && box.contains(s.anchorNode)) return s.getRangeAt(0)
        if (
          lastRange &&
          box.contains(lastRange.startContainer) &&
          box.contains(lastRange.endContainer)
        )
          return lastRange
        return null
      }
      const applyText = (box: HTMLElement, tc: TextChange): void => {
        const r = curRange()
        if (!r) return
        const out = r.collapsed ? applyCaret(box, r, tc) : applyInline(box, r, tc)
        if (!out) {
          if (r.collapsed) toast('첨자 안에서는 글자 모양을 바꿀 수 없어요')
          return
        }
        box.focus()
        const s = window.getSelection()
        s?.removeAllRanges()
        s?.addRange(out)
        lastRange = out.cloneRange()
        toolbar?.refresh()
      }
      toolbar = createToolbar({
        apply: (ch) => {
          const t = targetRect()
          if (!t) {
            toast('칸을 먼저 선택해 주세요')
            return
          }
          const box = ed.state.editing
          if (!box) {
            runCell(t, ch)
            return
          }
          const tc = textChangeOf(ch)
          if (tc) {
            applyText(box, tc)
            return
          }
          const cell = box.closest<HTMLElement>('.tq-cell')
          const changed = serializeCell(box) !== (cell?.dataset.raw ?? '')
          const reopen = (): void => {
            const x = cellAt(t.r1, t.c1)
            if (x) startEdit(x)
          }
          commit()
          if (changed)
            onceRendered(() => {
              if (runCell(t, ch)) onceRendered(reopen)
            })
          else if (runCell(t, ch)) onceRendered(reopen)
        },
        script: (kind) => {
          const box = ed.state.editing ?? tx.state.editing
          const s = window.getSelection()
          if (!box || !s || s.rangeCount === 0 || !box.contains(s.anchorNode)) {
            toast('칸을 편집하는 중에 눌러 주세요')
            return
          }
          const r = s.getRangeAt(0)
          const inSp = spanOf(r.commonAncestorContainer)
          if (!r.collapsed) {
            if (inSp) {
              if (inSp.dataset.s === kind) {
                const t = document.createTextNode((inSp.textContent ?? '').replace(ZWRE, ''))
                inSp.replaceWith(t)
                caretIn(t, t.length)
              } else {
                styleScript(inSp, kind)
              }
            } else {
              const picked = r.toString().replace(ZWRE, '')
              if (/\s/.test(picked)) {
                toast('공백이 든 글자는 첨자가 안 돼요')
                return
              }
              if (picked === '') return
              r.deleteContents()
              const sp = mkScript(kind, picked)
              r.insertNode(sp)
              leaveScript(sp)
            }
          } else if (inSp) {
            const cur = inSp.dataset.s
            leaveScript(inSp)
            if (cur !== kind) enterScript(kind)
          } else {
            enterScript(kind)
          }
          toolbar?.syncScript()
        },
        selStyle: () => {
          const box = ed.state.editing
          const r = curRange()
          return box && r ? inlineAt(box, r) : null
        },
        scriptState: () => {
          const s = window.getSelection()
          const sp = ed.state.editing && s ? spanOf(s.anchorNode) : null
          const k = sp?.dataset.s
          return k === 'sup' || k === 'sub' ? k : null
        },
        effective: () => {
          const t = targetRect()
          let xs: HTMLElement[] = t
            ? cells().filter((x) => {
                const p = rcOf(x)
                return p.r + p.rs > t.r1 && p.r <= t.r2 && p.c + p.cs > t.c1 && p.c <= t.c2
              })
            : []
          if (xs.length === 0) {
            const first = grid()?.querySelector<HTMLElement>('.tq-cell')
            if (first) xs = [first]
          }
          if (xs.length === 0) return null
          const same = (a: string[]): string | null => (a.every((v) => v === a[0]) ? a[0] : null)
          const fs = same(
            xs.map((x) => String(Math.round(parseFloat(x.style.fontSize) * 100) / 100))
          )
          const ff = same(
            xs.map((x) =>
              getComputedStyle(x)
                .fontFamily.split(',')[0]
                .trim()
                .replace(/^["']|["']$/g, '')
            )
          )
          return { fs: fs === 'NaN' ? null : fs, ff }
        },
        read: () => {
          const t = targetRect()
          const info = gridInfo()
          if (!t || !info) return null
          return readGrid((getLine) => readCellOpts(info, t, getLine))
        }
      })
      const mountBar = (): void => {
        if (!toolbar) return
        if (!toolbar.el.isConnected) el.prepend(toolbar.el)
        toolbar.setVisible(editModeRef.current)
      }
      mountBar()
      toolbar.el.addEventListener('focusout', (e) => {
        const to = e.relatedTarget as Node | null
        const box = ed.state.editing
        if (box && !(to && (box.contains(to) || toolbar?.el.contains(to)))) commit()
      })
      el.addEventListener('snote-rendered', mountBar)
      el.addEventListener('snote-editmode', mountBar)

      const onSel = (): void => {
        const box = ed.state.editing
        if (!box) return
        const s = window.getSelection()
        if (s && s.rangeCount > 0 && box.contains(s.anchorNode))
          lastRange = s.getRangeAt(0).cloneRange()
        toolbar?.syncScript()
        toolbar?.refresh()
      }
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
