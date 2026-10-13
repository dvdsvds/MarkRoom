import type { Extension } from '@codemirror/state'
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'

export function cursorMetrics(): Extension {
  return ViewPlugin.fromClass(
    class {
      constructor(view: EditorView) {
        this.sync(view)
      }
      update(u: ViewUpdate): void {
        this.sync(u.view)
      }
      sync(view: EditorView): void {
        view.requestMeasure({
          read: () => {
            const sy = parseFloat(getComputedStyle(document.body).zoom) || 1
            const lineHs = view.defaultLineHeight
            const lineH = lineHs / sy
            const head = view.state.selection.main.head
            const c = view.coordsAtPos(head)
            const node = view.domAtPos(head).node
            const el = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest(
              '.cm-line'
            )
            let topS = 0
            let chS = lineHs
            if (c && el) {
              const lr = el.getBoundingClientRect()
              topS = Math.max(0, (((c.top - lr.top) % lineHs) + lineHs) % lineHs)
              chS = c.bottom - c.top
            }
            return { lineHs, lineH, topS, chS, sy }
          },
          write: ({ lineHs, lineH, topS, chS, sy }) => {
            const s = view.dom.style
            s.setProperty('--cm-line-hs', `${lineHs}px`)
            s.setProperty('--cm-cur-tops', `${topS}px`)
            s.setProperty('--cm-line-h', `${lineH}px`)
            s.setProperty('--cm-cur-top', `${topS / sy}px`)
            s.setProperty('--cm-cur-h', `${chS / sy}px`)
          }
        })
      }
    }
  )
}