import { type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

export interface CursorPosition {
  line: number
  col: number
}

export function cursorReport(report: (pos: CursorPosition) => void): Extension {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged && !update.selectionSet) return
    const pos = update.state.selection.main.head
    const line = update.state.doc.lineAt(pos)
    report({ line: line.number, col: pos - line.from + 1 })
  })
}