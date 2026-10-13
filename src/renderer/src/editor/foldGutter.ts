import {
  foldable,
  foldedRanges,
  foldEffect,
  unfoldEffect
} from '@codemirror/language'
import type { EditorState, Extension } from '@codemirror/state'
import { EditorView, GutterMarker, gutter } from '@codemirror/view'
import chevronSvg from '../icons/chevron.svg?raw'

class FoldChevron extends GutterMarker {
  constructor(readonly folded: boolean) {
    super()
  }
  eq(other: GutterMarker): boolean {
    return other instanceof FoldChevron && other.folded === this.folded
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = `cm-snote-chevron${this.folded ? ' folded' : ''}`
    el.innerHTML = chevronSvg
    return el
  }
}

const chevronOpen = new FoldChevron(false)
const chevronFolded = new FoldChevron(true)

function foldedAt(
  state: EditorState,
  from: number,
  to: number
): { from: number; to: number } | null {
  let found = null as { from: number; to: number } | null
  foldedRanges(state).between(from, to, (a, b) => {
    if (a >= from && a <= to) {
      found = { from: a, to: b }
      return false
    }
    return undefined
  })
  return found
}

const foldTheme = EditorView.theme({
  '.cm-gutters > .cm-gutter.cm-foldGutter': { display: 'none !important' },
  '.cm-snote-fold': { minWidth: '16px' },
  '.cm-snote-fold .cm-gutterElement': {
    padding: '0',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  '.cm-snote-chevron': {
    display: 'flex',
    alignItems: 'center',
    height: 'calc(1em * var(--editor-line-height))',
    color: 'var(--color-text-tertiary)',
    opacity: '0',
    transition: 'opacity 0.12s'
  },
  '.cm-gutters:hover .cm-snote-chevron, .cm-snote-chevron.folded': { opacity: '1' },
  '.cm-snote-chevron:hover': { color: 'var(--color-text)' },
  '.cm-snote-chevron svg': { width: '12px', height: '12px', transform: 'rotate(90deg)' },
  '.cm-snote-chevron.folded svg': { transform: 'none' }
})

export function foldChevronGutter(): Extension {
  return [
    foldTheme,
    gutter({
      class: 'cm-snote-fold',
      lineMarker(view, line) {
        if (foldedAt(view.state, line.from, line.to)) return chevronFolded
        return foldable(view.state, line.from, line.to) ? chevronOpen : null
      },
      lineMarkerChange: (u) =>
        u.transactions.some((tr) =>
          tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect))
        ),
      initialSpacer: () => chevronOpen,
      domEventHandlers: {
        mousedown(view, line) {
          const folded = foldedAt(view.state, line.from, line.to)
          if (folded) {
            view.dispatch({ effects: unfoldEffect.of(folded) })
            return true
          }
          const range = foldable(view.state, line.from, line.to)
          if (range) view.dispatch({ effects: foldEffect.of(range) })
          return true
        }
      }
    })
  ]
}