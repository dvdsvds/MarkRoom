import { addCellParas, docLineReader, replaceCellParas } from '../editor/templateEdit'
import { splitColon, tokenize } from '../parse/templateUtil'
import { fillCell, mkScript, serializeCell } from '../view/cellInline'
import { enterMath, isMath, mathBeside, texOf } from '../view/cellMath'
import { renderMath } from '../view/mathText'
import type { Toolbar } from '../view/templateToolbar'
import { rcOf, whole, type GridSelection } from './gridSelection'
import { setLiveEdit } from './liveEdit'

export const ZW = '\u200b'
export const ZWRE = /\u200b/g
export type CellEditorState = { editing: HTMLElement | null }
const ALIGN_WORDS = ['left', 'center', 'right', 'justify', 'distribute']

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
  sync: () => void
  reload: () => void
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
  const makePara = (raw: string, head: string, css: string): HTMLElement => {
    const pd = document.createElement('div')
    pd.className = 'tq-para'
    pd.dataset.head = head
    pd.dataset.raw = raw
    pd.style.cssText = css
    fillCell(pd, raw)
    if (raw === '') pd.appendChild(document.createElement('br'))
    return pd
  }

  const splitPara = (box: HTMLElement): void => {
    const s = window.getSelection()
    if (!s || s.rangeCount === 0) return
    const r = s.getRangeAt(0)
    if (!r.collapsed) r.deleteContents()
    const at = r.startContainer instanceof Element ? r.startContainer : r.startContainer.parentElement
    const pd = at?.closest<HTMLElement>('.tq-para')
    if (!pd || !box.contains(pd)) return
    const tail = document.createRange()
    tail.setStart(r.startContainer, r.startOffset)
    tail.setEnd(pd, pd.childNodes.length)
    const np = pd.cloneNode(false) as HTMLElement
    np.appendChild(tail.extractContents())
    for (const x of [pd, np]) {
      const blank =
        (x.textContent ?? '').replace(ZWRE, '') === '' && !x.querySelector('math-field, .tq-math')
      if (blank) x.replaceChildren(document.createElement('br'))
    }
    pd.after(np)
    const c = document.createRange()
    c.setStart(np, 0)
    c.collapse(true)
    s.removeAllRanges()
    s.addRange(c)
  }
    const collectParas = (box: HTMLElement): { head: string; text: string }[] => {
    const out: { head: string; text: string }[] = []
    for (const pd of Array.from(box.querySelectorAll<HTMLElement>(':scope > .tq-para'))) {
      const head = pd.dataset.head ?? ''
      const text = serializeCell(pd)
      pd.dataset.raw = text
      for (const line of text.split('\n')) out.push({ head, text: line })
    }
    return out
  }
  const liveSync = (): void => {
    const box = state.editing
    const cell = box?.closest<HTMLElement>('.tq-cell')
    if (!box || !cell) return
    const paras = collectParas(box)
    const sig = JSON.stringify(paras)
    if (sig === box.dataset.orig) return
    if (cell.dataset.def !== undefined) {
      const def = Number(cell.dataset.def)
      replaceCellParas(def, Number(cell.dataset.end), paras)
      cell.dataset.end = String(def + paras.length + 1)
    } else if (cell.dataset.gridEnd !== undefined && paras.some((p) => p.text.trim() !== '')) {
      const p = rcOf(cell)
      const after = Number(cell.dataset.gridEnd)
      addCellParas(after, p.r, p.c, p.rs, p.cs, paras)
      cell.dataset.def = String(after + 1)
      cell.dataset.end = String(after + paras.length + 2)
      delete cell.dataset.gridEnd
    }
    box.dataset.orig = sig
  }
  const reload = (): void => {
    const box = state.editing
    const cell = box?.closest<HTMLElement>('.tq-cell')
    if (!box || !cell || cell.dataset.def === undefined) return
    const get = docLineReader()
    if (!get) return
    const def = Number(cell.dataset.def)
    const defText = get(def)
    if (!/^\s*(?:col|row)=/.test(defText)) {
      commit()
      return
    }
    const defInd = defText.length - defText.trimStart().length
    const items: { raw: string; head: string }[] = []
    let end = def
    if (/\[\s*$/.test(defText)) {
      for (let n = def + 1; n <= def + 500; n++) {
        const t = get(n).trim()
        if (t === ']') {
          end = n
          break
        }
        if (/^text(?:\s|:|$)/.test(t)) {
          const [h, v] = splitColon(t)
          if (v === null) continue
          items.push({ raw: v.trim(), head: tokenize(h).slice(1).join(' ') })
        } else if (t !== '') {
          items.push({ raw: t, head: '' })
        }
      }
    } else {
      for (let n = def + 1; n <= def + 500; n++) {
        const l = get(n)
        if (l.trim() === '' || l.length - l.trimStart().length <= defInd) break
        items.push({ raw: l.trim(), head: '' })
        end = n
      }
    }
    if (items.length === 0) items.push({ raw: '', head: '' })
    const prev = Array.from(box.querySelectorAll<HTMLElement>(':scope > .tq-para'))
    const paras = items.map((it, i) => {
      const css = prev[Math.min(i, prev.length - 1)]?.style.cssText ?? ''
      const pd = makePara(it.raw, it.head, css)
      const a = it.head.split(/\s+/).find((x) => ALIGN_WORDS.includes(x))
      pd.style.textAlign = a ? (a === 'distribute' ? 'left' : a) : (box.dataset.calign ?? '')
      return pd
    })
    box.replaceChildren(...paras)
    cell.dataset.end = String(end)
    box.dataset.orig = JSON.stringify(collectParas(box))
    const last = paras[paras.length - 1]
    const r = document.createRange()
    if (last.firstChild instanceof HTMLBRElement) r.setStart(last, 0)
    else {
      r.selectNodeContents(last)
      r.collapse(false)
    }
    const s = window.getSelection()
    s?.removeAllRanges()
    s?.addRange(r)
    toolbar()?.refresh()
  }
  const commit = (): void => {
    const box = state.editing
    if (!box) return
    state.editing = null
    toolbar()?.refresh()
    const cell = box.closest<HTMLElement>('.tq-cell')
    box.removeEventListener('keydown', onEditKey)
    box.removeEventListener('focusout', onFocusOut)
    box.removeEventListener('input', liveSync)
    setLiveEdit(false)
    const paras = collectParas(box)
    const sig = JSON.stringify(paras)
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
    if (!cell || sig === box.dataset.orig) return
    if (cell.dataset.def !== undefined) {
      replaceCellParas(Number(cell.dataset.def), Number(cell.dataset.end), paras)
    } else if (cell.dataset.gridEnd !== undefined && paras.some((p) => p.text.trim() !== '')) {
      const p = rcOf(cell)
      addCellParas(Number(cell.dataset.gridEnd), p.r, p.c, p.rs, p.cs, paras)
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
    const shown = Array.from(box.querySelectorAll<HTMLElement>(':scope > .tq-para'))
    const items =
      shown.length > 0
        ? shown.map((pd) => ({
            raw: pd.dataset.raw ?? '',
            head: pd.dataset.head ?? '',
            css: pd.style.cssText
          }))
        : (cell.dataset.raw ?? '').split('\n').map((raw) => ({ raw, head: '', css: '' }))
    const plain = shown.find(
      (pd) => !(pd.dataset.head ?? '').split(/\s+/).some((x) => ALIGN_WORDS.includes(x))
    )
    box.dataset.calign = plain?.style.textAlign || box.style.textAlign || ''
    box.replaceChildren(...items.map((it) => makePara(it.raw, it.head, it.css)))
    box.dataset.orig = JSON.stringify(items.map((it) => ({ head: it.head, text: it.raw })))
    box.contentEditable = 'plaintext-only'
    box.spellcheck = false
    state.editing = box
    toolbar()?.refresh()
    box.addEventListener('keydown', onEditKey)
    box.addEventListener('focusout', onFocusOut)
    box.addEventListener('input', liveSync)
    setLiveEdit(true)
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
    if (e.key === 'Enter' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault()
      splitPara(e.currentTarget as HTMLElement)
      liveSync()
      return
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

  return { state, spanOf, caretIn, leaveScript, enterScript, commit, startEdit, moveTab, sync: liveSync, reload }
}

export type CellEditor = ReturnType<typeof createCellEditor>