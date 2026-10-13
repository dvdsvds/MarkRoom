import { EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'
import { getCurrentView } from './currentView'

export function vimPointer(getVimMouse: () => boolean): Extension {
  return [
    EditorState.transactionFilter.of((tr) => {
      if (!tr.selection || !tr.isUserEvent('select.pointer')) return tr
      ;(globalThis as { __vimPointerSelect?: boolean }).__vimPointerSelect = true
      const cv = getCurrentView()
      const vimState = cv ? getCM(cv)?.state.vim : null
      if (!vimState || vimState.insertMode) return tr
      const sel = tr.newSelection.main
      if (!sel.empty) return tr
      const line = tr.newDoc.lineAt(sel.head)
      if (line.length > 0 && sel.head === line.to) {
        return [tr, { selection: { anchor: sel.head - 1 } }]
      }
      return tr
    }),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        const vimState = getCM(view)?.state.vim
        if (!vimState || getVimMouse()) return false
        event.preventDefault()
        view.focus()
        return true
      },
      keydown() {
        ;(globalThis as { __vimPointerSelect?: boolean }).__vimPointerSelect = false
        return false
      }
    })
  ]
}