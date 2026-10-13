import { applyGridEdit, readGrid } from '../../editor/templateEdit'
import {
  applyCaret,
  applyInline,
  inlineAt,
  mkScript,
  serializeCell,
  styleScript,
  textChangeOf,
  type TextChange
} from '../cellInline'
import { readCellOpts, setCellOpts, type CellOptChange } from '../gridEdit'
import { createToolbar, type Toolbar } from '../templateToolbar'
import { toast } from '../uiKit'
import { ZWRE, type CellEditor } from './cellEditor'
import { rcOf, whole, type GridSelection, type Sel } from './gridSelection'
import type { TextEditor } from './textEditor'

export function createToolbarBridge(opts: {
  el: HTMLElement
  grid: () => HTMLElement | null
  editMode: { current: boolean }
  gs: GridSelection
  ed: CellEditor
  tx: TextEditor
  onceRendered: (fn: () => void) => void
}): {
  toolbar: Toolbar
  mountBar: () => void
  onSel: () => void
} {
  const { el, grid, editMode, gs, ed, tx, onceRendered } = opts
  const { cells, cellAt, normalize, gridInfo } = gs
  const { spanOf, caretIn, leaveScript, enterScript, commit, startEdit } = ed

  let lastRange: Range | null = null

  const targetRect = (): Sel | null => {
    const sel = gs.state.sel
    if (sel) return normalize(sel)
    const c = ed.state.editing?.closest<HTMLElement>('.tq-cell')
    return c ? whole(c) : null
  }

  const runCell = (t: Sel, ch: CellOptChange): boolean => {
    const info = gridInfo()
    if (!info) return false
    const err = applyGridEdit((getLine) => setCellOpts(info, t, ch, getLine))
    if (err) toast(err)
    return !err
  }

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

  const toolbar: Toolbar = createToolbar({
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
      toolbar.syncScript()
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
      const fs = same(xs.map((x) => String(Math.round(parseFloat(x.style.fontSize) * 100) / 100)))
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

  function applyText(box: HTMLElement, tc: TextChange): void {
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
    toolbar.refresh()
  }

  const mountBar = (): void => {
    if (!toolbar.el.isConnected) el.prepend(toolbar.el)
    toolbar.setVisible(editMode.current)
  }

  const onSel = (): void => {
    const box = ed.state.editing
    if (!box) return
    const s = window.getSelection()
    if (s && s.rangeCount > 0 && box.contains(s.anchorNode)) lastRange = s.getRangeAt(0).cloneRange()
    toolbar.syncScript()
    toolbar.refresh()
  }

  toolbar.el.addEventListener('focusout', (e) => {
    const to = e.relatedTarget as Node | null
    const box = ed.state.editing
    if (box && !(to && (box.contains(to) || toolbar.el.contains(to)))) commit()
  })

  return { toolbar, mountBar, onSel }
}