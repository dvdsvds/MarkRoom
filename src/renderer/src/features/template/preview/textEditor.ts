import type { MutableRefObject } from 'react'
import { addTextLine, deleteEmptyTextLine, replaceTextLine, splitTextLine } from '../../../editor/templateEdit'
import type { Toolbar } from '../../../components/templateToolbar'

export type TextEditorState = { editing: HTMLElement | null }

export function createTextEditor(opts: {
  el: HTMLElement
  toolbar: () => Toolbar | null
  onceRendered: (fn: () => void) => void
  editMode: MutableRefObject<boolean>
}): {
  state: TextEditorState
  commit: () => void
  openText: (t: HTMLElement, at: { x: number; y: number } | null, where: 'start' | 'end') => void
  onTextClick: (e: MouseEvent) => void
} {
  const { el, toolbar, onceRendered, editMode } = opts
  const state: TextEditorState = { editing: null }
  let tStart = ''
  let tHtml = ''

  const tNorm = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, ' ').trim()

  const commit = (): void => {
    const box = state.editing
    if (!box) return
    state.editing = null
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

  const openText = (
    t: HTMLElement,
    at: { x: number; y: number } | null,
    where: 'start' | 'end'
  ): void => {
    if (state.editing) commit()
    state.editing = t
    tHtml = t.innerHTML
    t.innerText = (t.dataset.raw ?? '').replace(/\\n/g, '\n')
    tStart = tNorm(t.innerText)
    t.contentEditable = 'plaintext-only'
    t.spellcheck = false
    t.addEventListener('focusout', tOut)
    t.addEventListener('keydown', tKey)
    t.focus()
    const d = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null
    }
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

  function tOut(e: FocusEvent): void {
    const to = e.relatedTarget as Node | null
    const box = state.editing
    if (to && box && (box.contains(to) || toolbar()?.el.contains(to))) return
    commit()
  }

  function tKey(e: KeyboardEvent): void {
    e.stopPropagation()
    if (e.isComposing) return
    if (e.key === 'Escape') {
      e.preventDefault()
      commit()
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
      onceRendered(() => {
        if (!removed) return
        const prev = el.querySelector<HTMLElement>(`.tp-text[data-tline="${ln - 1}"]`)
        if (prev) openText(prev, null, 'end')
      })
      removed = deleteEmptyTextLine(ln)
      if (!removed) return
      state.editing = null
      bx.removeEventListener('focusout', tOut)
      bx.removeEventListener('keydown', tKey)
      bx.contentEditable = 'false'
      return
    }
    if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.metaKey
    ) {
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
      const list = Array.from(el.querySelectorAll<HTMLElement>('.tp-text[data-tline]'))
      const nx = list[list.indexOf(ax) + (up ? -1 : 1)]
      if (!nx) return
      e.preventDefault()
      openText(nx, null, 'end')
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
    state.editing = null
    box.removeEventListener('focusout', tOut)
    box.removeEventListener('keydown', tKey)
    box.contentEditable = 'false'
    onceRendered(() => {
      const next = el.querySelector<HTMLElement>(`.tp-text[data-tline="${line + 1}"]`)
      if (next) openText(next, null, 'start')
    })
    splitTextLine(line, before, after)
  }

  const addTextLineAtEnd = (page: HTMLElement): void => {
    const close = Number(page.closest<HTMLElement>('.snote-template-wrap')?.dataset.close)
    if (!Number.isInteger(close)) return
    if (state.editing) commit()
    let added = true
    onceRendered(() => {
      if (!added) return
      const next = el.querySelector<HTMLElement>(`.tp-text[data-tline="${close}"]`)
      if (next) openText(next, null, 'start')
    })
    added = addTextLine(close)
  }

  const onTextClick = (e: MouseEvent): void => {
    if (!editMode.current || e.button !== 0) return
    const tg = e.target instanceof Element ? e.target : null
    if (!tg || tg.closest('.tq-cell, .tp-edit-btn')) return
    let t = tg.closest<HTMLElement>('.tp-text[data-tline]')
    const direct = t !== null
    if (!t) {
      const page = tg.closest<HTMLElement>('.snote-page')
      if (!page) return
      const all = Array.from(page.querySelectorAll<HTMLElement>('.tp-text[data-tline]'))
      if (all.length === 0) {
        addTextLineAtEnd(page)
        return
      }
      let bestD = Infinity
      for (const x of all) {
        const r = x.getBoundingClientRect()
        const d =
          e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0
        if (d < bestD) {
          bestD = d
          t = x
        }
      }
    }
    if (!t || t === state.editing) return
    openText(t, direct ? { x: e.clientX, y: e.clientY } : null, 'end')
  }

  return { state, commit, openText, onTextClick }
}

export type TextEditor = ReturnType<typeof createTextEditor>