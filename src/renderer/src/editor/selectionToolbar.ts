import { EditorView, showTooltip, type Tooltip, type TooltipView } from '@codemirror/view'
import { StateEffect, StateField, type Extension } from '@codemirror/state'
import { getCM } from '@replit/codemirror-vim'
import boldIcon from '../icons/tb-bold.svg?raw'
import italicIcon from '../icons/tb-italic.svg?raw'
import strikeIcon from '../icons/tb-strike.svg?raw'
import codeIcon from '../icons/tb-code-inline.svg?raw'
import linkIcon from '../icons/tb-link.svg?raw'

const toolbarEffect = StateEffect.define<boolean>()

const toolbarField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(toolbarEffect)) return e.value
    if (tr.docChanged || tr.selection) return false
    return value
  }
})

function wrapSelection(view: EditorView, mark: string): void {
  const { from, to } = view.state.selection.main
  const doc = view.state.doc
  const before = doc.sliceString(Math.max(0, from - mark.length), from)
  const after = doc.sliceString(to, Math.min(doc.length, to + mark.length))
  if (before === mark && after === mark) {
    view.dispatch({
      changes: [
        { from: from - mark.length, to: from },
        { from: to, to: to + mark.length }
      ],
      selection: { anchor: from - mark.length, head: to - mark.length },
      effects: toolbarEffect.of(true)
    })
  } else {
    view.dispatch({
      changes: [
        { from, insert: mark },
        { from: to, insert: mark }
      ],
      selection: { anchor: from + mark.length, head: to + mark.length },
      effects: toolbarEffect.of(true)
    })
  }
}

function wrapLink(view: EditorView): void {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: [
      { from, insert: '[' },
      { from: to, insert: '](url)' }
    ],
    selection: { anchor: to + 3, head: to + 6 }
  })
}

const toolbarButtons: { label: string; title: string; run: (view: EditorView) => void }[] = [
  { label: boldIcon, title: '굵게', run: (v) => wrapSelection(v, '**') },
  { label: italicIcon, title: '기울임', run: (v) => wrapSelection(v, '*') },
  { label: strikeIcon, title: '취소선', run: (v) => wrapSelection(v, '~~') },
  { label: codeIcon, title: '코드', run: (v) => wrapSelection(v, '`') },
  { label: linkIcon, title: '링크', run: wrapLink }
]

function createToolbar(view: EditorView): TooltipView {
  const dom = document.createElement('div')
  dom.className = 'sel-toolbar'
  for (const b of toolbarButtons) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = b.title
    btn.innerHTML = b.label.trim()
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      b.run(view)
    })
    dom.appendChild(btn)
  }
  return { dom }
}

const toolbarTooltip = showTooltip.compute([toolbarField, 'selection'], (state): Tooltip | null => {
  const sel = state.selection.main
  if (!state.field(toolbarField) || sel.empty) return null
  return { pos: sel.from, above: true, strictSide: true, arrow: false, create: createToolbar }
})

export function selectionToolbar(): Extension {
  return [
    toolbarField,
    toolbarTooltip,
    EditorView.domEventHandlers({
      mouseup(event, view) {
        if (event.button !== 0) return false
        setTimeout(() => {
          if (getCM(view)?.state.vim) return
          if (view.state.selection.main.empty) return
          view.dispatch({ effects: toolbarEffect.of(true) })
        }, 0)
        return false
      }
    })
  ]
}