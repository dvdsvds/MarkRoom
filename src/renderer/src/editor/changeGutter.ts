import {
  RangeSet,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
  type Text
} from '@codemirror/state'
import { GutterMarker, ViewPlugin, gutter, type EditorView, type ViewUpdate } from '@codemirror/view'
import { diffToRows } from '../utils/diff'

type ChangeKind = 'add' | 'mod' | 'del'

class ChangeMarker extends GutterMarker {
  constructor(readonly kind: ChangeKind) {
    super()
  }
  eq(other: GutterMarker): boolean {
    return other instanceof ChangeMarker && other.kind === this.kind
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = `cm-change-marker cm-change-${this.kind}`
    return el
  }
}

const changeMarkers: Record<ChangeKind, ChangeMarker> = {
  add: new ChangeMarker('add'),
  mod: new ChangeMarker('mod'),
  del: new ChangeMarker('del')
}

const setChangeMarkers = StateEffect.define<RangeSet<GutterMarker>>()

const changeMarkersField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setChangeMarkers)) return e.value
    return value.map(tr.changes)
  }
})

function computeChangeMarkers(base: string, doc: Text): RangeSet<GutterMarker> {
  const rows = diffToRows(base, doc.toString())
  const kinds = new Map<number, ChangeKind>()
  let line = 1
  for (const row of rows) {
    if (row.rightType === 'empty') {
      const target = Math.min(line, doc.lines)
      if (!kinds.has(target)) kinds.set(target, 'del')
    } else {
      if (row.rightType === 'add') kinds.set(line, row.leftType === 'remove' ? 'mod' : 'add')
      line++
    }
  }
  const builder = new RangeSetBuilder<GutterMarker>()
  for (const [n, kind] of [...kinds].sort((a, b) => a[0] - b[0])) {
    const pos = doc.line(n).from
    builder.add(pos, pos, changeMarkers[kind])
  }
  return builder.finish()
}

export function changeGutter(base: string, onClick: () => void): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | null = null
      constructor(view: EditorView) {
        this.schedule(view, 0)
      }
      update(u: ViewUpdate): void {
        if (u.docChanged) this.schedule(u.view, 300)
      }
      schedule(view: EditorView, delay: number): void {
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          view.dispatch({
            effects: setChangeMarkers.of(computeChangeMarkers(base, view.state.doc))
          })
        }, delay)
      }
      destroy(): void {
        if (this.timer) clearTimeout(this.timer)
      }
    }
  )
  return [
    changeMarkersField,
    plugin,
    gutter({
      class: 'cm-change-gutter',
      markers: (view) => view.state.field(changeMarkersField),
      domEventHandlers: {
        mousedown: () => {
          onClick()
          return true
        }
      }
    })
  ]
}