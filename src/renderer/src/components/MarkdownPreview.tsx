import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { markdownRenderer } from '../markdown/renderMarkdown'
import { renderBlocks } from './outputBlocks'
import { applyResult, blockToText, outputToText } from '../markdown/resultText'
import { ParsedBlock } from '@renderer/markdown/blockPlugin'
import { runPython } from '@renderer/python/pyRunner'
import { renderTemplate } from './templateRender'
import type { ParsedTemplate } from '@renderer/markdown/templatePlugin'
import { addCellText, applyGridEdit, readGrid, redoEditor, replaceCellText, undoEditor } from '../editor/MarkdownEditor'
import { createToolbar, type Toolbar } from './templateToolbar'
import {
  deleteCols,
  deleteRows,
  dragColWidths,
  insertCols,
  insertRows,
  mergeGrid,
  setColWidths,
  setRowHeight,
  splitGrid,
  setBorders,
  setDiagonals,
  readCellOpts,
  setCellOpts,
  type CellOptChange,
  type BorderKind,
  type BorderWhere,
  type GridInfo,
  type GridResult,
  type Rect
} from './gridEdit'

export interface MarkdownPreviewHandle {
  scrollToRatio: (ratio: number) => void
}

interface MarkdownPreviewProps {
  source: string
  baseDir?: string
  onScrollRatio?: (ratio: number) => void
  onWikilinkClick?: (title: string) => void
  onToggleTask?: (line: number) => void
  onReplaceSource? : (next: string) => void
  className?: string
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview({ source, baseDir, onScrollRatio, onWikilinkClick, onToggleTask, onReplaceSource, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const onScrollRatioRef = useRef(onScrollRatio)
    const onWikilinkClickRef = useRef(onWikilinkClick)
    const onToggleTaskRef = useRef(onToggleTask)
    const onReplaceSourceRef = useRef(onReplaceSource)
    const sourceRef = useRef(source)
    useEffect(() => {
      onScrollRatioRef.current = onScrollRatio
      onWikilinkClickRef.current = onWikilinkClick
      onToggleTaskRef.current = onToggleTask
      onReplaceSourceRef.current = onReplaceSource
      sourceRef.current = source
    })

    const html = useMemo(() => markdownRenderer.render(source, baseDir), [source, baseDir])

    useImperativeHandle(ref, () => ({
      scrollToRatio: (ratio: number) => {
        const el = containerRef.current
        if (!el) return
        const max = el.scrollHeight - el.clientHeight
        el.scrollTop = max > 0 ? ratio * max : 0
      }
    }))

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const handleScroll = (): void => {
        const max = el.scrollHeight - el.clientHeight
        onScrollRatioRef.current?.(max > 0 ? el.scrollTop / max : 0)
      }
      el.addEventListener('scroll', handleScroll, { passive: true })
      return () => el.removeEventListener('scroll', handleScroll)
    }, [])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const handleClick = (e: MouseEvent): void => {
        const target = (e.target as HTMLElement | null)?.closest('[data-wikilink]')
        if (!target) return
        const title = target.getAttribute('data-wikilink')
        if (title) onWikilinkClickRef.current?.(title)
      }
      el.addEventListener('click', handleClick)
      return () => el.removeEventListener('click', handleClick)
    }, [])
    
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const handleClick = (e: MouseEvent): void => {
        const input = (e.target as HTMLElement | null)?.closest('input.task-list-item-checkbox')
        if (!input) return
        const li = input.closest('li[data-line]')
        const line = li ? Number(li.getAttribute('data-line')) : NaN
        if (Number.isNaN(line)) return
        onToggleTaskRef.current?.(line)
      }
      el.addEventListener('click', handleClick)
      return () => el.removeEventListener('click', handleClick)
    }, [])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const blocks = Array.from(el.querySelectorAll<HTMLElement>('pre > code.language-mermaid'))
      if (blocks.length === 0) return
      let cancelled = false
      void (async () => {
        const { default: mermaid } = await import('mermaid')
        if (cancelled) return
        const css = getComputedStyle(document.documentElement)
        const v = (name: string): string => css.getPropertyValue(name).trim()
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          look: 'classic',
          theme: 'base',
          fontFamily: 'Pretendard, sans-serif',
          themeVariables: {
            fontSize: '13px',
            background: v('--color-bg'),
            textColor: v('--color-text'),
            primaryColor: v('--color-bg-soft'),
            primaryTextColor: v('--color-text'),
            primaryBorderColor: v('--color-text-tertiary'),
            secondaryColor: v('--color-bg-soft'),
            tertiaryColor: v('--color-bg'),
            lineColor: v('--color-text-tertiary'),
            edgeLabelBackground: v('--color-bg')
          }
        })
        for (const [i, code] of blocks.entries()) {
          const pre = code.parentElement
          if (!pre) continue
          const id = `mermaid-${Date.now()}-${i}`
          try {
            const { svg } = await mermaid.render(id, code.textContent ?? '')
            if (cancelled) return
            const wrap = document.createElement('div')
            wrap.className = 'mermaid-diagram'
            wrap.innerHTML = svg
            pre.replaceWith(wrap)
          } catch {
            document.getElementById(`d${id}`)?.remove()
          }
        }
      })()
      return () => {
        cancelled = true
      }
    }, [html])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      for (const node of Array.from(
        el.querySelectorAll<HTMLElement>(
          'span.snote-color[data-fg^="#"], span.snote-color[data-bg^="#"]'
        )
      )) {
        const fg = node.dataset.fg
        const bg = node.dataset.bg
        if (fg?.startsWith('#')) node.style.setProperty('--snote-fg', fg)
        if (bg?.startsWith('#')) node.style.setProperty('--snote-bg', bg)
      }
    }, [html])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      for (const node of Array.from(el.querySelectorAll<HTMLElement>('div.snote-block'))) {
        let parsed: ParsedBlock
        try {
          parsed = JSON.parse(node.dataset.spec ?? '') as ParsedBlock
        } catch {
          parsed = { error: '블록을 읽을 수 없어요.' }
        }
        if ('error' in parsed) {
          const e = document.createElement('div')
          e.className = 'code-run-out error'
          e.textContent = parsed.error
          node.replaceChildren(e)
        } else {
          node.replaceChildren(...renderBlocks([parsed.block]))
        }
      }
    }, [html])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      for (const [ti, node] of Array.from(
        el.querySelectorAll<HTMLElement>('div.snote-template')
      ).entries()) {
        let parsed: ParsedTemplate
        try {
          parsed = JSON.parse(node.dataset.spec ?? '') as ParsedTemplate
        } catch {
          parsed = { error: '양식을 읽을 수 없어요.' }
        }
        if ('error' in parsed) {
          const e = document.createElement('div')
          e.className = 'code-run-out error'
          e.textContent = parsed.error
          node.replaceChildren(e)
        } else {
          const wrap =renderTemplate(parsed)
          const btn = document.createElement('button')
          btn.type = 'button'
          btn.className = 'tp-edit-btn'
          const on = editIdxRef.current === ti
          btn.textContent = on ? '편집 끝' : '편집'
          if (on) wrap.classList.add('tq-editmode')
          btn.addEventListener('click', (e) => {
            e.stopPropagation()
            const next = editIdxRef.current === ti ? null : ti
            editIdxRef.current = next
            editModeRef.current = next !== null
            el.dispatchEvent(new Event('snote-editmode'))
            for (const w of Array.from(el.querySelectorAll<HTMLElement>('.snote-template-wrap'))) {
              w.classList.remove('tq-editmode')
              const b = w.querySelector<HTMLButtonElement>('.tp-edit-btn')
              if (b) b.textContent = '편집'
            }
            if (next !== null) {
              wrap.classList.add('tq-editmode')
              btn.textContent = '편집 끝'
            }
            for (const n of Array.from(el.querySelectorAll('.tq-selected'))) n.classList.remove('tq-selected')
          })
          wrap.appendChild(btn)
          node.replaceChildren(wrap)
        }
      }

      const pages = Array.from(el.querySelectorAll<HTMLElement>('.snote-page'))
      el.style.maxWidth = pages.length > 0 ? 'none' : ''
      el.style.padding = pages.length > 0 ? '4px' : ''
      if (pages.length === 0) return

      const PAGE_W = (210 / 25.4) * 96
      const PAGE_H = (297 / 25.4) * 96
      const MAX_SCALE = 2
      const MIN_SCALE = 0.1
      let raf = 0

      const fit = (): void => {
        const cs = getComputedStyle(el)
        const availW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        const bar = el.querySelector<HTMLElement>('.tq-toolbar')
        const barH = bar && bar.offsetHeight > 0 ? bar.offsetHeight + 6 : 0
        const availH = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2 - barH
        for (const page of pages) {
          page.style.setProperty('zoom', '1')
          const h = Math.max(PAGE_H, page.offsetHeight)
          const scale = Math.min(MAX_SCALE, availW / PAGE_W, availH / h)
          page.style.setProperty('zoom', String(Math.max(MIN_SCALE, scale)))
        }
      }
      const schedule = (): void => {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(fit)
      }

      fit()
      const ro = new ResizeObserver(schedule)
      el.addEventListener('snote-editmode', schedule)
      ro.observe(el)
      void document.fonts.ready.then(schedule)
      el.dispatchEvent(new Event('snote-rendered'))
      return () => {
        el.style.padding = ''
        cancelAnimationFrame(raf)
        ro.disconnect()
        el.removeEventListener('snote-editmode', schedule)
      }
    }, [html])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const blocks = Array.from(
        el.querySelectorAll<HTMLElement>(
          'pre > code.language-js, pre > code.language-javascript, pre > code.language-python, pre > code.language-py'
        )
      )
      const cleanups: (() => void)[] = []
      for (const code of blocks) {
        const pre = code.parentElement
        if (!pre) continue
        const box = document.createElement('div')
        box.className = 'code-run'
        const bar = document.createElement('div')
        bar.className = 'code-run-bar'
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'code-run-btn'
        button.textContent = '▶ 실행'
        bar.append(button)

        const startLine = Number(code.dataset.line)
        const endLine = Number(code.dataset.end)
        const canSave =
          Number.isInteger(startLine) && Number.isInteger(endLine) && endLine > startLine
        const saveBtn = canSave ? document.createElement('button') : null
        if (saveBtn) {
          saveBtn.type = 'button'
          saveBtn.className = 'code-run-btn'
          saveBtn.textContent = '저장'
          saveBtn.disabled = true
          bar.append(saveBtn)
        }

        const out = document.createElement('pre')
        out.className = 'code-run-out'
        out.hidden = true
        const blocksBox = document.createElement('div')
        blocksBox.className = 'code-run-blocks'
        box.append(bar, blocksBox, out)
        pre.after(box)

        const codeText = code.textContent ?? ''
        const isPython = /\blanguage-(python|py)\b/.test(code.className)
        let saved: string[][] | null = null

        const onClick = async (): Promise<void> => {
          button.disabled = true
          button.textContent = isPython ? '실행 중… (처음엔 몇 초 걸려요)' : '실행 중…'
          if (saveBtn) saveBtn.disabled = true
          const r = isPython
            ? await runPython(codeText, baseDir ?? '')
            : await window.api.code.run(codeText, baseDir ?? '')
          const lines: string[] = []
          if (r.output) lines.push(r.output)
          if (r.result !== null) lines.push(`→ ${r.result}`)
          if (r.error) lines.push(r.error)
          const hasBlocks = r.blocks.length > 0
          out.textContent = lines.join('\n') || (hasBlocks ? '' : '(출력 없음)')
          out.classList.toggle('error', Boolean(r.error))
          out.hidden = lines.length === 0 && hasBlocks
          blocksBox.replaceChildren(...renderBlocks(r.blocks))
          button.disabled = false
          button.textContent = '▶ 다시 실행'

          const textLines: string[] = []
          if (r.output) textLines.push(r.output)
          if (r.result !== null) textLines.push(`→ ${r.result}`)
          const parts = r.blocks.map((b) => blockToText(b))
          if (textLines.length > 0) parts.push(outputToText(textLines.join('\n')))
          saved = r.error || parts.length === 0 ? null : parts
          if (saveBtn) {
            saveBtn.disabled = saved === null
            saveBtn.textContent = '저장'
          }
        }

        const onSave = (): void => {
          if (!saveBtn || !saved) return
          const next = applyResult(sourceRef.current, startLine, endLine, saved)
          if (next === null) {
            saveBtn.textContent = '위치를 못 찾았어요'
            return
          }
          onReplaceSourceRef.current?.(next)
        }

        button.addEventListener('click', onClick)
        saveBtn?.addEventListener('click', onSave)
        cleanups.push(() => {
          button.removeEventListener('click', onClick)
          saveBtn?.removeEventListener('click', onSave)
          box.remove()
        })
      }
      return () => {
        for (const c of cleanups) c()
      }
    }, [html, baseDir])

    const editIdxRef = useRef<number | null>(null)
    const editModeRef = useRef(false)

    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      type Sel = { r1: number; c1: number; r2: number; c2: number }
      let anchor: { r: number; c: number } | null = null
      let head: { r: number; c: number } | null = null
      let sel: Sel | null = null
      let editing: HTMLElement | null = null
      let drag: { r: number; c: number; moved: boolean } | null = null
      let toolbar: Toolbar | null = null

      const grid = (): HTMLElement | null =>
        editIdxRef.current === null
          ? null
          : (Array.from(el.querySelectorAll<HTMLElement>('.snote-template-wrap'))[editIdxRef.current] ?? null)
      let gridIdx: number | null = null
      const gridEl = (): HTMLElement | null => {
        const g = grid()
        if (!g || gridIdx === null) return null
        return Array.from(g.querySelectorAll<HTMLElement>('.tq-grid'))[gridIdx] ?? null
      }
      const cells = (): HTMLElement[] =>
        Array.from(gridEl()?.querySelectorAll<HTMLElement>('.tq-cell') ?? [])
      const pickGrid = (x: HTMLElement): void => {
        const g = grid()
        const tg = x.closest<HTMLElement>('.tq-grid')
        if (!g || !tg) return
        const before = gridIdx
        gridIdx = Array.from(g.querySelectorAll('.tq-grid')).indexOf(tg)
        if (gridIdx !== before) {
          sel = null
          anchor = null
          head = null
          paint()
        }
      }
      const rcOf = (c: HTMLElement): { r: number; c: number; rs: number; cs: number } => ({
        r: Number(c.dataset.r),
        c: Number(c.dataset.c),
        rs: Number(c.dataset.rs),
        cs: Number(c.dataset.cs)
      })
      const cellAt = (r: number, c: number): HTMLElement | null => {
        for (const x of cells()) {
          const p = rcOf(x)
          if (r >= p.r && r < p.r + p.rs && c >= p.c && c < p.c + p.cs) return x
        }
        return null
      }
      const size = (): { rows: number; cols: number } => {
        let rows = 0
        let cols = 0
        for (const x of cells()) {
          const p = rcOf(x)
          rows = Math.max(rows, p.r + p.rs)
          cols = Math.max(cols, p.c + p.cs)
        }
        return { rows, cols }
      }
      const paint = (): void => {
        for (const n of Array.from(el.querySelectorAll('.tq-selected'))) n.classList.remove('tq-selected')
        toolbar?.refresh()
        el.dispatchEvent(new Event('snote-editmode'))
        if (!sel) return
        for (const x of cells()) {
          const p = rcOf(x)
          if (p.r + p.rs > sel.r1 && p.r <= sel.r2 && p.c + p.cs > sel.c1 && p.c <= sel.c2) {
            x.classList.add('tq-selected')
          }
        }
      }
      const normalize = (s: Sel): Sel => {
        let { r1, c1, r2, c2 } = s
        for (let again = true; again; ) {
          again = false
          for (const x of cells()) {
            const p = rcOf(x)
            if (p.r + p.rs > r1 && p.r <= r2 && p.c + p.cs > c1 && p.c <= c2) {
              if (p.r < r1) (r1 = p.r), (again = true)
              if (p.c < c1) (c1 = p.c), (again = true)
              if (p.r + p.rs - 1 > r2) (r2 = p.r + p.rs - 1), (again = true)
              if (p.c + p.cs - 1 > c2) (c2 = p.c + p.cs - 1), (again = true)
            }
          }
        }
        return { r1, c1, r2, c2 }
      }
      const select = (
        s: Sel | null,
        a?: { r: number; c: number },
        h?: { r: number; c: number }
      ): void => {
        sel = s ? normalize(s) : null
        if (!sel) {
          anchor = null
          head = null
        } else {
          anchor = a ?? { r: sel.r1, c: sel.c1 }
          head = h ?? { r: sel.r2, c: sel.c2 }
        }
        paint()
      }
      const whole = (x: HTMLElement): Sel => {
        const p = rcOf(x)
        return { r1: p.r, c1: p.c, r2: p.r + p.rs - 1, c2: p.c + p.cs - 1 }
      }

      const commit = (): void => {
        const box = editing
        if (!box) return
        editing = null
        toolbar?.refresh()
        const cell = box.closest<HTMLElement>('.tq-cell')
        box.removeEventListener('keydown', onEditKey)
        box.removeEventListener('blur', commit)
        const value = box.innerText.replace(/\n$/, '')
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
        if (editing) commit()
        pickGrid(cell)
        const box = cell.querySelector<HTMLElement>('.tq-text')
        if (!box) return
        sel = null
        paint()
        cell.classList.add('tq-editing')
        box.textContent = cell.dataset.raw ?? ''
        box.contentEditable = 'plaintext-only'
        box.spellcheck = false
        editing = box
        toolbar?.refresh()
        box.addEventListener('keydown', onEditKey)
        box.addEventListener('blur', commit)
        box.focus()
        const s = window.getSelection()
        if (!s) return
        let placed = false
        if (at) {
          const d = document as Document & {
            caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
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
      }
      const moveTab = (from: { r: number; c: number; rs: number; cs: number }, dir: number): void => {
        const { rows, cols } = size()
        let r = from.r
        let c = dir > 0 ? from.c + from.cs : from.c - 1
        for (let guard = 0; guard < rows * cols + 2; guard++) {
          if (c >= cols) (c = 0), r++
          if (c < 0) (c = cols - 1), r--
          if (r < 0 || r >= rows) return
          const x = cellAt(r, c)
          if (x) {
            startEdit(x)
            return
          }
          c += dir
        }
      }
      function onEditKey(e: KeyboardEvent): void {
        e.stopPropagation()
        if (e.isComposing) return
        const box = e.currentTarget as HTMLElement
        const cell = box.closest<HTMLElement>('.tq-cell')
        if (!cell) return
        const p = rcOf(cell)
        if (e.key === 'Escape' || e.key === 'F5') {
          e.preventDefault()
          const here = whole(cell)
          commit()
          window.setTimeout(() => select(here), 0)
        } else if (e.key === 'Tab') {
          e.preventDefault()
          commit()
          window.setTimeout(() => moveTab(p, e.shiftKey ? -1 : 1), 0)
        } else if (e.key.startsWith('Arrow') && !e.shiftKey && !e.ctrlKey && !e.altKey) {
          const s = window.getSelection()
          if (!s || !s.isCollapsed || !s.anchorNode) return
          const full = box.innerText.replace(/\n$/, '')
          const range = document.createRange()
          range.selectNodeContents(box)
          range.setEnd(s.anchorNode, s.anchorOffset)
          const off = range.toString().length
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
          commit()
          const { rows, cols } = size()
          window.setTimeout(() => {
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return
            const t = cellAt(nr, nc)
            if (t) startEdit(t)
          }, 0)
        }
      }

      const cellOf = (t: EventTarget | null): HTMLElement | null => {
        const x = t instanceof Element ? t.closest<HTMLElement>('.tq-cell') : null
        return x && grid()?.contains(x) ? x : null
      }
      const onDown = (e: MouseEvent): void => {
        if (!editModeRef.current || e.button !== 0) return
        const x = cellOf(e.target)
        if (!x) return
        pickGrid(x)
        if (x.classList.contains('tq-editing') && !e.shiftKey) return
        const p = rcOf(x)
        if (e.shiftKey) {
          e.preventDefault()
          if (editing) commit()
          const cur = sel ?? whole(x)
          select({
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
        const ge = gridEl()
        if (ge && !ge.contains(x)) return
        if (p.r === drag.r && p.c === drag.c && !drag.moved && !sel) return
        drag.moved = true
        e.preventDefault()
        if (editing) commit()
        window.getSelection()?.removeAllRanges()
        select(
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
        if (!editModeRef.current || !d || d.moved || sel) return
        const x = cellOf(e.target)
        if (!x || x.classList.contains('tq-editing')) return
        startEdit(x, { x: e.clientX, y: e.clientY })
      }
      const toast = (msg: string): void => {
        const d = document.createElement('div')
        d.textContent = msg
        d.style.cssText =
          'position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:9999;background:#333;color:#fff;padding:8px 14px;border-radius:6px;font-size:13px'
        document.body.appendChild(d)
        window.setTimeout(() => d.remove(), 2500)
      }
      const gridInfo = (): GridInfo | null => {
        const g = gridEl()
        if (!g || g.dataset.head === undefined || g.dataset.close === undefined) return null
        try {
          return {
            head: Number(g.dataset.head),
            close: Number(g.dataset.close),
            cols: Number(g.dataset.cols),
            widths: JSON.parse(g.dataset.widths ?? '[]') as (number | null)[],
            heights: JSON.parse(g.dataset.heights ?? '[]') as number[],
            cells: cells().map((x) => ({
              ...rcOf(x),
              def: x.dataset.def !== undefined ? Number(x.dataset.def) : null,
              end: x.dataset.end !== undefined ? Number(x.dataset.end) : null
            }))
          }
        } catch {
          return null
        }
      }
      const doMerge = (): void => {
        const info = gridInfo()
        if (!info || !sel) return
        const rect: Rect = normalize(sel)
        const err = applyGridEdit((getLine) => mergeGrid(info, rect, getLine))
        if (err) toast(err)
        else select(null)
      }
      const askSplit = (): void => {
        const info = gridInfo()
        if (!info || !sel) return
        const rect: Rect = normalize(sel)
        const box = document.createElement('div')
        box.style.cssText =
          'position:fixed;left:50%;top:30%;transform:translateX(-50%);z-index:9999;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-text-tertiary);border-radius:8px;padding:12px 14px;display:flex;gap:8px;align-items:center;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.3)'
        const mk = (label: string, max: number): HTMLInputElement => {
          const t = document.createElement('span')
          t.textContent = label
          const i = document.createElement('input')
          i.type = 'number'
          i.min = '1'
          i.max = String(max)
          i.value = label === '칸 수' ? '2' : '1'
          i.style.cssText = 'width:56px;padding:2px 4px;border:1px solid var(--color-text-tertiary);border-radius:4px;background:transparent;color:inherit'
          box.append(t, i)
          return i
        }
        const ci = mk('칸 수', 100)
        const ri = mk('줄 수', 200)
        const hint = document.createElement('span')
        hint.textContent = 'Enter 확인 · Esc 취소'
        hint.style.opacity = '0.6'
        box.append(hint)
        const close = (): void => box.remove()
        const ok = (): void => {
          const n = Math.floor(Number(ci.value))
          const m = Math.floor(Number(ri.value))
          if (!(n >= 1) || !(m >= 1) || n * m < 2) {
            toast('나눌 칸 수와 줄 수를 확인해 주세요')
            return
          }
          close()
          const err = applyGridEdit((getLine) => splitGrid(info, rect, n, m, getLine))
          if (err) toast(err)
          else select(null)
        }
        box.addEventListener('keydown', (ev) => {
          ev.stopPropagation()
          if (ev.key === 'Enter') {
            ev.preventDefault()
            ok()
          } else if (ev.key === 'Escape') {
            ev.preventDefault()
            close()
          }
        })
        document.body.appendChild(box)
        ci.focus()
        ci.select()
      } 
      const doEdit = (fn: (info: GridInfo, rect: Rect, getLine: (n: number) => string) => GridResult): void => {
        const info = gridInfo()
        if (!info || !sel) return
        const rect: Rect = normalize(sel)
        const err = applyGridEdit((getLine) => fn(info, rect, getLine))
        if (err) toast(err)
        else select(null)
      }
      const onKey = (e: KeyboardEvent): void => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
          const k = e.key.toLowerCase()
          if (k === 'z' || k === 'y') {
            e.preventDefault()
            if (k === 'y' || e.shiftKey) redoEditor()
            else undoEditor()
            return
          }
        }
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
        const t = e.target as HTMLElement | null
        if (t?.closest('.cm-editor')) return
        if (e.key === 'Escape' && borderPanel) {
          e.preventDefault()
          closeBorderPanel()
          return
        }
        if (e.key === 'F5') {
          e.preventDefault()
          const { rows, cols } = size()
          if (sel) select({ r1: 0, c1: 0, r2: rows - 1, c2: cols - 1 })
          return
        }
        if (!sel) return
        if (editModeRef.current && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
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
        if (editModeRef.current && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const alt = e.shiftKey
          if (e.code === 'KeyL' && !alt) {
            e.preventDefault()
            toggleBorderPanel()
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
          if (x) moveTab(rcOf(x), e.shiftKey ? -1 : 1)
        } else if (e.key.startsWith('Arrow') && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          const { rows, cols } = size()
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

      type Hit = { g: HTMLElement; kind: 'col' | 'row'; idx: number }
      const PX_MM = 96 / 25.4
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
          if (Math.abs(e.clientX - (r.left + (acc / sc) * r.width)) <= TOL) return { g: t, kind: 'col', idx: k }
        }
        acc = 0
        for (let k = 0; k < rows.length; k++) {
          acc += rows[k]
          if (Math.abs(e.clientY - (r.top + (acc / sr) * r.height)) <= TOL) return { g: t, kind: 'row', idx: k }
        }
        return null
      }
      const onHover = (e: MouseEvent): void => {
        if (!editModeRef.current || rz) return
        for (const x of Array.from(el.querySelectorAll('.tq-hot-col, .tq-hot-row'))) {
          x.classList.remove('tq-hot-col', 'tq-hot-row')
        }
        if (drag || e.buttons & 1) return
        const h = hitTest(e)
        if (h) h.g.classList.add(h.kind === 'col' ? 'tq-hot-col' : 'tq-hot-row')
      }
      const onResizeDown = (e: MouseEvent): void => {
        if (!editModeRef.current || e.button !== 0) return
        const hit = hitTest(e)
        if (!hit) return
        e.preventDefault()
        e.stopPropagation()
        if (editing) commit()
        pickGrid(hit.g)
        const info = gridInfo()
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
          const dmm = (((e.clientY - rz.start) * sum) / rect.height) / PX_MM
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
      let bs: { kind: BorderKind; w: number | null; c: string | null } = { kind: 'solid', w: null, c: null }
      let borderPanel: HTMLElement | null = null
      const closeBorderPanel = (): void => {
        borderPanel?.remove()
        borderPanel = null
      }
      const runBorder = (fn: (info: GridInfo, rect: Rect, getLine: (n: number) => string) => GridResult): void => {
        const info = gridInfo()
        if (!info || !sel) {
          toast('칸을 먼저 선택해 주세요')
          return
        }
        const rect: Rect = normalize(sel)
        const err = applyGridEdit((getLine) => fn(info, rect, getLine))
        if (err) toast(err)
      }
      const toggleBorderPanel = (): void => {
        if (borderPanel) {
          closeBorderPanel()
          return
        }
        const BTN =
          'width:28px;height:28px;padding:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--color-text-tertiary);border-radius:5px;background:transparent;color:inherit;cursor:pointer'
        const SEL =
          'width:100%;padding:3px 4px;border:1px solid var(--color-text-tertiary);border-radius:5px;background:transparent;color:inherit;color-scheme:light dark'
        const box = document.createElement('div')
        box.style.cssText =
          'position:fixed;left:50%;top:10%;transform:translateX(-50%);z-index:9999;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-text-tertiary);border-radius:10px;padding:14px;display:flex;gap:18px;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.35);user-select:none'

        const icon = (draw: string): string =>
          `<svg width="18" height="18" viewBox="0 0 18 18" style="display:block"><rect x="2" y="2" width="14" height="14" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-dasharray="2 2"/>${draw}</svg>`
        const ln = (x1: number, y1: number, x2: number, y2: number): string =>
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="2.2"/>`
        const frame = '<rect x="2" y="2" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2"/>'
        const cross = ln(9, 2, 9, 16) + ln(2, 9, 16, 9)
        const mk = (html: string, title: string, on: () => void, css = BTN): HTMLButtonElement => {
          const b = document.createElement('button')
          b.type = 'button'
          b.title = title
          b.style.cssText = css
          b.innerHTML = html
          b.addEventListener('mousedown', (ev) => ev.preventDefault())
          b.addEventListener('click', on)
          return b
        }
        const at = (b: HTMLElement, x: number, y: number): HTMLElement => {
          b.style.position = 'absolute'
          b.style.left = `${x}px`
          b.style.top = `${y}px`
          return b
        }

        // 왼쪽: 종류 / 굵기 / 색
        const left = document.createElement('div')
        left.style.cssText = 'width:140px;display:flex;flex-direction:column;gap:8px'
        const head = document.createElement('div')
        head.textContent = '테두리'
        head.style.cssText = 'font-weight:600;border-bottom:1px solid var(--color-text-tertiary);padding-bottom:4px'
        left.appendChild(head)
        const field = (label: string, opts: [string, string][], cur: string, on: (v: string) => void): void => {
          const wrap = document.createElement('label')
          wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px'
          const t = document.createElement('span')
          t.textContent = label
          t.style.opacity = '.7'
          const s = document.createElement('select')
          s.style.cssText = SEL
          for (const [v, l] of opts) {
            const o = document.createElement('option')
            o.value = v
            o.textContent = l
            s.appendChild(o)
          }
          s.value = cur
          s.addEventListener('change', () => on(s.value))
          wrap.append(t, s)
          left.appendChild(wrap)
        }
        field(
          '종류',
          [['solid', '실선'], ['dashed', '점선'], ['double', '이중선'], ['none', '없음']],
          bs.kind,
          (v) => (bs = { ...bs, kind: v as BorderKind })
        )
        field(
          '굵기',
          [['', '기본'], ...['0.1', '0.15', '0.2', '0.3', '0.4', '0.5', '0.7', '1', '1.5', '2', '3'].map((w): [string, string] => [w, `${w}mm`])],
          bs.w === null ? '' : String(bs.w),
          (v) => (bs = { ...bs, w: v === '' ? null : Number(v) })
        )
        field(
          '색',
          [['', '기본(검정)'], ['red', '빨강'], ['orange', '주황'], ['yellow', '노랑'], ['green', '초록'], ['blue', '파랑'], ['purple', '보라'], ['gray', '회색']],
          bs.c ?? '',
          (v) => (bs = { ...bs, c: v === '' ? null : v })
        )

        // 오른쪽: 미리보기 네모와 1~6 버튼
        const right = document.createElement('div')
        const area = document.createElement('div')
        area.style.cssText = 'position:relative;width:200px;height:150px'
        const pv = document.createElement('div')
        pv.style.cssText =
          'position:absolute;left:28px;top:34px;width:120px;height:90px;border:1px solid var(--color-text-tertiary);box-sizing:border-box'
        pv.innerHTML =
          '<div style="position:absolute;left:50%;top:0;bottom:0;border-left:1px dashed var(--color-text-tertiary)"></div><div style="position:absolute;top:50%;left:0;right:0;border-top:1px dashed var(--color-text-tertiary)"></div>'
        area.appendChild(pv)
        const w = (where: BorderWhere) => (): void => runBorder((i, r, g) => setBorders(i, r, where, { ...bs }, g))
        area.appendChild(at(mk(icon(ln(2, 2, 2, 16)), '왼쪽', w('left')), 14, 2))
        area.appendChild(at(mk(icon(ln(9, 2, 9, 16)), '세로 가운데', w('vmid')), 74, 2))
        area.appendChild(at(mk(icon(ln(16, 2, 16, 16)), '오른쪽', w('right')), 134, 2))
        area.appendChild(at(mk(icon(ln(2, 2, 16, 2)), '위쪽', w('top')), 160, 20))
        area.appendChild(at(mk(icon(ln(2, 9, 16, 9)), '가로 가운데', w('hmid')), 160, 64))
        area.appendChild(at(mk(icon(ln(2, 16, 16, 16)), '아래쪽', w('bottom')), 160, 108))
        right.appendChild(area)

        const row = (): HTMLElement => {
          const r = document.createElement('div')
          r.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px'
          return r
        }
        const wide = 'height:28px;padding:0 8px;display:flex;align-items:center;gap:5px;border:1px solid var(--color-text-tertiary);border-radius:5px;background:transparent;color:inherit;cursor:pointer'
        const r1 = row()
        r1.append(
          mk(icon(frame + cross) + '모두', '모두 (바깥쪽 + 안쪽)', w('all'), wide),
          mk(icon(frame) + '바깥쪽', '바깥쪽', w('outer'), wide),
          mk(icon(cross) + '안쪽', '안쪽', w('inner'), wide)
        )
        const r2 = row()
        const dg = (dir: 'down' | 'up') => (): void =>
          runBorder((i, r, g) => setDiagonals(i, r, dir, { ...bs }, g))
        const dl = document.createElement('span')
        dl.textContent = '대각선'
        dl.style.opacity = '.7'
        r2.append(
          dl,
          mk(icon(ln(2, 2, 16, 16)), '대각선 ↘', dg('down')),
          mk(icon(ln(2, 16, 16, 2)), '대각선 ↗', dg('up'))
        )
        right.append(r1, r2)

        const hint = document.createElement('div')
        hint.textContent = '버튼을 누르면 바로 적용돼요 · L 또는 Esc: 닫기'
        hint.style.cssText = 'opacity:.6;font-size:12px;margin-top:8px'
        right.appendChild(hint)

        box.append(left, right)
        document.body.appendChild(box)
        borderPanel = box
      }
      const restore = (): void => {
        const keep = sel
        editing = null
        sel = keep && cellAt(keep.r1, keep.c1) ? normalize(keep) : null
        paint()
      }
      const targetRect = (): Sel | null => {
        if (sel) return normalize(sel)
        const c = editing?.closest<HTMLElement>('.tq-cell')
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
      toolbar = createToolbar({
        apply: (ch) => {
          const t = targetRect()
          if (!t) {
            toast('칸을 먼저 선택해 주세요')
            return
          }
          const box = editing
          if (!box) {
            runCell(t, ch)
            return
          }
          // 편집 중이면: 입력한 글자를 먼저 저장 → 다시 그려진 뒤 옵션 적용 → 다시 그려진 뒤 그 칸 편집 재개
          const cell = box.closest<HTMLElement>('.tq-cell')
          const changed = box.innerText.replace(/\n$/, '') !== (cell?.dataset.raw ?? '')
          const reopen = (): void => {
            const x = cellAt(t.r1, t.c1)
            if (x) startEdit(x)
          }
          commit()
          if (changed) onceRendered(() => { if (runCell(t, ch)) onceRendered(reopen) })
          else if (runCell(t, ch)) onceRendered(reopen)
        },
        script: (kind) => {
          const box = editing
          const s = window.getSelection()
          if (!box || !s || !box.contains(s.anchorNode)) {
            toast('칸을 편집하는 중에 글자를 선택하고 눌러 주세요')
            return
          }
          const mark = kind === 'sup' ? '^' : '~'
          const picked = s.toString()
          if (/\s/.test(picked)) {
            toast('공백이 든 글자는 첨자가 안 돼요')
            return
          }
          if (picked === '') {
            document.execCommand('insertText', false, mark + mark)
            ;(s as Selection & { modify?: (a: string, b: string, c: string) => void }).modify?.('move', 'backward', 'character')
          } else if (picked.length >= 3 && picked.startsWith(mark) && picked.endsWith(mark)) {
            document.execCommand('insertText', false, picked.slice(1, -1))
          } else {
            document.execCommand('insertText', false, mark + picked + mark)
          }
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
      el.addEventListener('snote-rendered', mountBar)
      el.addEventListener('snote-editmode', mountBar)
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
      el.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      window.addEventListener('keydown', onKey, true)
      el.addEventListener('snote-rendered', restore)
      return () => {
        el.removeEventListener('mousedown', onDown)
        el.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        window.removeEventListener('keydown', onKey, true)
        window.removeEventListener('scroll', resetPageScroll)
        closeBorderPanel()
        el.removeEventListener('mousedown', onResizeDown, true)
        el.removeEventListener('mousemove', onHover)
        window.removeEventListener('mousemove', onResizeMove)
        window.removeEventListener('mouseup', onResizeUp)
        el.removeEventListener('snote-rendered', restore)
        el.removeEventListener('snote-rendered', mountBar)
        el.removeEventListener('snote-editmode', mountBar)
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