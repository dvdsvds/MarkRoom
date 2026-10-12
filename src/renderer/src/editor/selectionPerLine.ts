import { RangeSetBuilder, type Text } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'

const lineDeco = Decoration.line({ class: 'cm-sel-line' })
const charDeco = Decoration.mark({ class: 'cm-vsel' })

class NewlineCell extends WidgetType {
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-vsel'
    el.textContent = '\u00a0'
    return el
  }
  eq(): boolean {
    return true
  }
  ignoreEvent(): boolean {
    return true
  }
}
const newlineDeco = Decoration.widget({ widget: new NewlineCell(), side: 1 })

type VPos = { line: number; ch: number }
type VimState = {
  visualMode?: boolean
  visualLine?: boolean
  visualBlock?: boolean
  sel?: { anchor: VPos; head: VPos }
}

function toIndex(doc: Text, p: VPos): number {
  const n = Math.min(Math.max(p.line + 1, 1), doc.lines)
  const l = doc.line(n)
  return l.from + Math.min(Math.max(p.ch, 0), l.length)
}

function buildChar(view: EditorView, sel: NonNullable<VimState['sel']>): DecorationSet {
  const doc = view.state.doc
  const a = toIndex(doc, sel.anchor)
  const h = toIndex(doc, sel.head)
  const from = Math.min(a, h)
  const last = Math.max(a, h)
  const firstLine = doc.lineAt(from).number
  const lastLine = doc.lineAt(last).number
  const b = new RangeSetBuilder<Decoration>()
  for (let n = firstLine; n <= lastLine; n++) {
    const l = doc.line(n)
    const start = Math.max(from, l.from)
    let end: number
    let cell: boolean
    if (n < lastLine) {
      end = l.to
      cell = false
    } else if (last === l.to) {
      end = l.to
      cell = true
    } else {
      const cp = doc.sliceString(last, last + 2).codePointAt(0) ?? 0
      end = last + (cp > 0xffff ? 2 : 1)
      cell = false
    }
    if (end > start) b.add(start, end, charDeco)
    if (cell || (l.length === 0 && n < lastLine)) b.add(l.to, l.to, newlineDeco)
  }
  return b.finish()
}

function buildLines(view: EditorView, inVisual: boolean): DecorationSet {
  const doc = view.state.doc
  const lines = new Set<number>()
  for (const r of view.state.selection.ranges) {
    if (r.empty && !inVisual) continue
    const first = doc.lineAt(r.from).number
    let last = doc.lineAt(r.to).number
    if (!inVisual && last > first && r.to === doc.line(last).from) last--
    if (!inVisual && first === last) continue
    for (let n = first; n <= last; n++) lines.add(n)
  }
  const b = new RangeSetBuilder<Decoration>()
  for (const n of [...lines].sort((x, y) => x - y)) {
    const p = doc.line(n).from
    b.add(p, p, lineDeco)
  }
  return b.finish()
}

export const selectionPerLine = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    dom: HTMLElement
    constructor(view: EditorView) {
      this.dom = view.dom
      this.decorations = this.rebuild(view)
    }
    update(u: ViewUpdate): void {
      if (u.selectionSet || u.docChanged || u.transactions.length > 0) {
        this.decorations = this.rebuild(u.view)
      }
    }
    rebuild(view: EditorView): DecorationSet {
      const vim = getCM(view)?.state.vim as unknown as VimState | undefined
      const inVisual = !!vim?.visualMode
      const charMode = inVisual && !vim?.visualLine && !vim?.visualBlock && !!vim?.sel
      this.dom.classList.toggle('cm-vim-v', charMode)
      if (charMode) return buildChar(view, vim!.sel!)
      if (inVisual && !vim?.visualLine) return Decoration.none
      return buildLines(view, inVisual)
    }
    destroy(): void {
      this.dom.classList.remove('cm-vim-v')
    }
  },
  { decorations: (v) => v.decorations }
)
