import { applyValues } from '../markdown/valueBlock'
import copyIcon from '../icons/tb-copy.svg?raw'
import checkIcon from '../icons/tb-check.svg?raw'
import playIcon from '../icons/tb-play.svg?raw'
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { markdownRenderer } from '../markdown/renderMarkdown'
import { renderBlocks } from './outputBlocks'
import { applyResult, blockToText, outputToText } from '../markdown/resultText'
import { ParsedBlock } from '@renderer/markdown/blockPlugin'
import { runPython } from '@renderer/python/pyRunner'
import { renderTemplate } from './templateRender'
import type { ParsedTemplate } from '@renderer/markdown/templatePlugin'
import { addCellText, applyGridEdit, deleteEmptyTextLine, readGrid, redoEditor, replaceCellText, replaceTextLine, splitTextLine, undoEditor } from '../editor/MarkdownEditor'
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
  type GridInfo,
  type GridResult,
  type Rect
} from './gridEdit'
import { toast } from './uiKit'
import { openBorderPanel, openSplitPanel, type BorderState } from './templatePanels'
import { readEdges } from './templateRead'
import { renderMath } from './mathText'
import { applyCaret, applyInline, fillCell, inlineAt, mkScript, serializeCell, styleScript, textChangeOf, type TextChange } from './cellInline'
import { enterMath, isMath, mathBeside, texOf } from './cellMath'

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
  /** 문서 안 가장 넓은 이미지가 줄어들지 않고 들어갈 프리뷰 최소 너비(px). 이미지가 없으면 0. */
  onMinWidthChange?: (px: number) => void
  /** 문서에 서식(template)이 들어 있는지. 들어 있으면 App이 5:5로 고정한다. */
  onHasTemplateChange?: (has: boolean) => void
  className?: string
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview({ source, baseDir, onScrollRatio, onWikilinkClick, onToggleTask, onReplaceSource, onMinWidthChange, onHasTemplateChange, className }, ref) {
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

    // 이미지는 크기 고정이라, 가장 넓은 이미지가 들어가는 너비를 App에 알려준다.
    const onMinWidthChangeRef = useRef(onMinWidthChange)
    const onHasTemplateChangeRef = useRef(onHasTemplateChange)
    useEffect(() => {
      onMinWidthChangeRef.current = onMinWidthChange
      onHasTemplateChangeRef.current = onHasTemplateChange
    }, [onMinWidthChange, onHasTemplateChange])
    useEffect(() => {
      onHasTemplateChangeRef.current?.(html.includes('snote-template'))
    }, [html])
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      // 좌우 패딩(px-6 = 48) + 스크롤바(6)
      const EXTRA = 54
      const imgs = Array.from(el.querySelectorAll<HTMLImageElement>('img')).filter(
        (img) => !img.closest('.snote-page')
      )
      const measure = (): void => {
        const w = imgs.reduce((m, img) => Math.max(m, img.naturalWidth), 0)
        onMinWidthChangeRef.current?.(w > 0 ? Math.ceil(w) + EXTRA : 0)
      }
      measure()
      for (const img of imgs) if (!img.complete) img.addEventListener('load', measure)
      return () => {
        for (const img of imgs) img.removeEventListener('load', measure)
      }
    }, [html])

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
      const timers: number[] = []
      for (const code of Array.from(el.querySelectorAll<HTMLElement>('pre > code'))) {
        const pre = code.parentElement
        if (!pre || pre.querySelector(':scope > .pre-copy')) continue
        const lang = /\blanguage-([\w+#-]+)/.exec(code.className)?.[1]
        if (lang && lang !== 'mermaid') pre.dataset.lang = lang
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'pre-copy'
        btn.title = '복사'
        btn.innerHTML = copyIcon.trim()
        btn.addEventListener('click', () => {
          void navigator.clipboard.writeText(code.textContent ?? '').then(() => {
            btn.classList.add('done')
            btn.innerHTML = checkIcon.trim()
            timers.push(
              window.setTimeout(() => {
                btn.classList.remove('done')
                btn.innerHTML = copyIcon.trim()
              }, 1200)
            )
          })
        })
        pre.prepend(btn)
      }
      return () => {
        for (const t of timers) window.clearTimeout(t)
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
      el.style.padding = pages.length > 0 ? '0' : ''
      if (pages.length === 0) return

      const PAGE_W = (210 / 25.4) * 96
      const MAX_SCALE = 2
      const MIN_SCALE = 0.1
      let raf = 0

      const fit = (): void => {
        const cs = getComputedStyle(el)
        const availW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
        for (const page of pages) {
          page.style.setProperty('zoom', '1')
          const scale = Math.min(MAX_SCALE, availW / PAGE_W)
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
        button.className = 'code-run-btn run'
        const setRunLabel = (label: string): void => {
          button.innerHTML = `${playIcon.trim()}<span></span>`
          const span = button.querySelector('span')
          if (span) span.textContent = label
        }
        setRunLabel('실행')
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

        let pendingValues: Record<string, string> = {}
        const valueBtn = document.createElement('button')
        valueBtn.type = 'button'
        valueBtn.className = 'code-run-btn'
        valueBtn.textContent = '값 적용'
        valueBtn.hidden = true
        bar.append(valueBtn)

        const onClick = async (): Promise<void> => {
          button.disabled = true
          setRunLabel(isPython ? '실행 중… (처음엔 몇 초 걸려요)' : '실행 중…')
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
          setRunLabel('다시 실행')
          pendingValues = r.error ? {} : (r.values ?? {})
          const n = Object.keys(pendingValues).length
          valueBtn.hidden = n === 0
          valueBtn.textContent = `값 적용 (${n})`
          valueBtn.disabled = false

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

        const onApplyValues = (): void => {
        const next = applyValues(sourceRef.current, pendingValues)
        if (next === null) {
          valueBtn.textContent = 'template을 못 찾았어요'
          return
        }
        onReplaceSourceRef.current?.(next)
      }

        button.addEventListener('click', onClick)
        saveBtn?.addEventListener('click', onSave)
        valueBtn.addEventListener('click', onApplyValues)
        cleanups.push(() => {
          button.removeEventListener('click', onClick)
          saveBtn?.removeEventListener('click', onSave)
          valueBtn.removeEventListener('click', onApplyValues)
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
      let f5Whole = false
      let toolbar: Toolbar | null = null
      const ZWRE = /\u200b/g
      const ZW = '\u200b'
      const fillBox = fillCell
      const serializeBox = serializeCell
      const spanOf = (n: Node | null): HTMLElement | null => {
        const box = editing
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
        refreshBorderPanel()
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
        f5Whole = false
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
        box.removeEventListener('focusout', onFocusOut)
        const value = serializeBox(box)
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
        if (editing) commit()
        pickGrid(cell)
        const box = cell.querySelector<HTMLElement>('.tq-text')
        if (!box) return
        sel = null
        paint()
        cell.classList.add('tq-editing')
        fillBox(box, cell.dataset.raw ?? '')
        box.contentEditable = 'plaintext-only'
        box.spellcheck = false
        editing = box
        toolbar?.refresh()
        box.addEventListener('keydown', onEditKey)
        box.addEventListener('focusout', onFocusOut)
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
        if (at) {
          const hit = document.elementFromPoint(at.x, at.y)?.closest('math-field')
          if (isMath(hit)) enterMath(hit, 'end')
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
      function onFocusOut(e: FocusEvent): void {
        const to = e.relatedTarget as Node | null
        if (to && editing && (editing.contains(to) || toolbar?.el.contains(to))) return
        commit()
      }
      function onEditKey(e: KeyboardEvent): void {
        e.stopPropagation()
        if (e.isComposing) return
        if ((e.target as Element | null)?.closest?.('math-field') && e.key !== 'Escape' && e.key !== 'F5') return
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
            if (viaF5) f5Whole = true
          }, 0)
        } else if (e.key === 'Tab') {
          e.preventDefault()
          commit()
          window.setTimeout(() => moveTab(p, e.shiftKey ? -1 : 1), 0)
        } else if (e.key.startsWith('Arrow') && !e.shiftKey && !e.ctrlKey && !e.altKey) {
          const near = e.key === 'ArrowRight' ? mathBeside(box, 1) : e.key === 'ArrowLeft' ? mathBeside(box, -1) : null
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

      let tEdit: HTMLElement | null = null
      let tStart = ''
      let tHtml = ''

      const tNorm = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, ' ').trim()

      const tCommit = (): void => {
        const box = tEdit
        if (!box) return
        tEdit = null
        box.removeEventListener('focusout', tOut)
        box.removeEventListener('keydown', tKey)
        box.contentEditable = 'false'
        const value = tNorm(box.innerText ?? '')
        if (value === tStart) {
          box.innerHTML = tHtml
          return
        }
        replaceTextLine(Number(box.dataset.tline), value)
      }

      const openText = (t: HTMLElement, at: { x: number; y: number } | null, where: 'start' | 'end'): void => {
        if (tEdit) tCommit()
        tEdit = t
        tHtml = t.innerHTML
        t.innerText = (t.dataset.raw ?? '').replace(/\\n/g, '\n')
        tStart = tNorm(t.innerText)
        t.contentEditable = 'plaintext-only'
        t.spellcheck = false
        t.addEventListener('focusout', tOut)
        t.addEventListener('keydown', tKey)
        t.focus()
        const d = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }
        let rg = at ? (d.caretRangeFromPoint?.(at.x, at.y) ?? null) : null
        if (!rg || !t.contains(rg.startContainer)) {
          rg = document.createRange()
          rg.selectNodeContents(t)
          rg.collapse(where === 'start')
      }
      const s = window.getSelection()
      s?.removeAllRanges()
      s?.addRange(rg)
    }

    const root0 = (): HTMLElement => el as HTMLElement
    function tOut(e: FocusEvent): void {
      const to = e.relatedTarget as Node | null
      if (to && tEdit && (tEdit.contains(to) || toolbar?.el.contains(to))) return
      tCommit()
    }

    function tKey(e: KeyboardEvent): void {
      e.stopPropagation()
      if (e.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        tCommit()
        return
      }
      if (e.key === 'Backspace') {
        const bx = e.currentTarget as HTMLElement
        const sl = window.getSelection()
        if (!sl || !sl.isCollapsed) return
        if (bx.innerText.replace(/[\s\u200b]/g, '') !== '') return
        e.preventDefault()
        const ln = Number(bx.dataset.tline)
        let removed = true
        const root = el
        onceRendered(() => {
          if (!removed) return
          const prev = root?.querySelector<HTMLElement>(`.tp-text[data-tline="${ln - 1}"]`)
          if (prev) openText(prev, null, 'end')
        })
        removed = deleteEmptyTextLine(ln)
        if (!removed) return
        tEdit = null
        bx.removeEventListener('focusout', tOut)
        bx.removeEventListener('keydown', tKey)
        bx.contentEditable = 'false'
        return
      }
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const ax = e.currentTarget as HTMLElement
        const sa = window.getSelection()
        if (!sa || !sa.isCollapsed || !sa.anchorNode || !ax.contains(sa.anchorNode)) return
        const all = ax.innerText.replace(/\n$/, '')
        const rr = document.createRange()
        rr.selectNodeContents(ax)
        rr.setEnd(sa.anchorNode, sa.anchorOffset)
        const off = rr.toString().length
        const up = e.key === 'ArrowUp'
        if (up ? all.slice(0, off).includes('\n') : all.slice(off).includes('\n')) return
        const list = Array.from(root0().querySelectorAll<HTMLElement>('.tp-text[data-tline]'))
        const nx = list[list.indexOf(ax) + (up ? -1 : 1)]
        if (!nx) return
        e.preventDefault()
        openText(nx, null, up ? 'end' : 'end')
      }
      if (e.key !== 'Enter') return
      e.preventDefault()
      const box = e.currentTarget as HTMLElement
      const s = window.getSelection()
      if (!s || s.rangeCount === 0 || !box.contains(s.anchorNode)) return
      const r = s.getRangeAt(0)
      const full = box.innerText.replace(/\n$/, '')
      const pre = document.createRange()
      pre.selectNodeContents(box)
      pre.setEnd(r.startContainer, r.startOffset)
      const upTo = document.createRange()
      upTo.selectNodeContents(box)
      upTo.setEnd(r.endContainer, r.endOffset)
      const before = full.slice(0, pre.toString().length)
      const after = full.slice(upTo.toString().length)
      const line = Number(box.dataset.tline)
      tEdit = null
      box.removeEventListener('focusout', tOut)
      box.removeEventListener('keydown', tKey)
      box.contentEditable = 'false'
      const root = el
      onceRendered(() => {
        const next = root?.querySelector<HTMLElement>(`.tp-text[data-tline="${line + 1}"]`)
        if (next) openText(next, null, 'start')
      })
      splitTextLine(line, before, after)
    }
    const onTextClick = (e: MouseEvent): void => {
      if (!editModeRef.current || e.button !== 0) return
      const tg = e.target instanceof Element ? e.target : null
      if (!tg || tg.closest('.tq-cell, .tp-edit-btn')) return
      let t = tg.closest<HTMLElement>('.tp-text[data-tline]')
      const direct = t !== null
      if (!t) {
        const page = tg.closest<HTMLElement>('.snote-page')
        if (!page) return
        let bestD = Infinity
        for (const x of Array.from(page.querySelectorAll<HTMLElement>('.tp-text[data-tline]'))) {
          const r = x.getBoundingClientRect()
          const d = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0
          if (d < bestD) {
            bestD = d
            t = x
          }
        }
      }
      if (!t || t === tEdit) return
      openText(t, direct ? { x: e.clientX, y: e.clientY } : null, 'end')
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
      const doEdit = (fn: (info: GridInfo, rect: Rect, getLine: (n: number) => string) => GridResult): void => {
        const info = gridInfo()
        if (!info || !sel) return
        const rect: Rect = normalize(sel)
        const err = applyGridEdit((getLine) => fn(info, rect, getLine))
        if (err) toast(err)
        else select(null)
      }
      const onKey = (e: KeyboardEvent): void => {
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
          if (e.repeat) return
          if (!sel) return
          const { rows, cols } = size()
          if (f5Whole) {
            select({ r1: 0, c1: 0, r2: rows - 1, c2: cols - 1 })
          } else {
            const x = cellAt(sel.r1, sel.c1)
            if (x) select(whole(x))
            f5Whole = true
          }
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
            const t = nr >= 0 && nc >= 0 && nr < rows && nc < cols ? cellAt(nr, nc) : null
            if (t) select(whole(t))
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
      const bs: BorderState = { kind: 'solid', w: null, c: null}
      let borderPanel: ReturnType<typeof openBorderPanel> | null = null
      const closeBorderPanel = (): void => {
        borderPanel?.box.remove()
        borderPanel = null
      }
      const refreshBorderPanel = (): void => {
        if (!borderPanel) return
        const g = gridEl()
        borderPanel.setEdges(g && sel ? readEdges(g, normalize(sel)) : {})
      }
      const runBorder = (fn: (info: GridInfo, rect: Rect, getLine: (n: number) => string) => GridResult): boolean => {
        const info = gridInfo()
        if (!info || !sel) {
          toast('칸을 먼저 선택해 주세요')
          return false
        }
        const rect: Rect = normalize(sel)
        const err = applyGridEdit((getLine) => fn(info, rect, getLine))
        if (err) toast(err)
        return !err
      }
      const toggleBorderPanel = (): void => {
        if (borderPanel) {
          closeBorderPanel()
          return
        }
        borderPanel = openBorderPanel({
          st: bs,
          borders: (where) => runBorder((i, r, g) => setBorders(i, r, where, { ...bs }, g)),
          diagonal: (dir) => runBorder((i, r, g) => setDiagonals(i, r, dir, { ...bs }, g)),
          onClose: closeBorderPanel
        })
        refreshBorderPanel()
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
      let lastRange: Range | null = null
      const curRange = (): Range | null => {
        const box = editing
        if (!box) return null
        const s = window.getSelection()
        if (s && s.rangeCount > 0 && box.contains(s.anchorNode)) return s.getRangeAt(0)
        if (lastRange && box.contains(lastRange.startContainer) && box.contains(lastRange.endContainer)) return lastRange
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
          const box = editing
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
          const changed = serializeBox(box) !== (cell?.dataset.raw ?? '')
          const reopen = (): void => {
            const x = cellAt(t.r1, t.c1)
            if (x) startEdit(x)
          }
          commit()
          if (changed) onceRendered(() => { if (runCell(t, ch)) onceRendered(reopen) })
          else if (runCell(t, ch)) onceRendered(reopen)
        },
        script: (kind) => {
          const box = editing ?? tEdit
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
          const box = editing
          const r = curRange()
          return box && r ? inlineAt(box, r) : null
        },
        scriptState: () => {
          const s = window.getSelection()
          const sp = editing && s ? spanOf(s.anchorNode) : null
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
          const fs = same(xs.map((x) => String(Math.round(parseFloat(x.style.fontSize) * 100) / 100)))
          const ff = same(xs.map((x) => getComputedStyle(x).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')))
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
        if (editing && !(to && (editing.contains(to) || toolbar?.el.contains(to)))) commit()
      })
      el.addEventListener('snote-rendered', mountBar)
      el.addEventListener('snote-editmode', mountBar)
      const onSel = (): void => {
        if (!editing) return
        const s = window.getSelection()
        if (s && s.rangeCount > 0 && editing.contains(s.anchorNode)) lastRange = s.getRangeAt(0).cloneRange()
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
        closeBorderPanel()
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