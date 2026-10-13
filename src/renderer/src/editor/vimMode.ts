import { type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'

export function vimModeTracker(reportVimMode: (mode: string) => void): Extension {
  let lastVimMode = ''
  return EditorView.updateListener.of((update) => {
    const cm = getCM(update.view)
    const vimState = cm?.state.vim
    if (!vimState) return
    const mode = vimState.insertMode
      ? 'INSERT'
      : vimState.visualMode
        ? vimState.visualLine
          ? 'VISUAL LINE'
          : vimState.visualBlock
            ? 'VISUAL BLOCK'
            : 'VISUAL'
        : 'NORMAL'
    reportVimMode(mode)
    if (mode === 'NORMAL') {
      const sel = update.state.selection.main
      const line = update.state.doc.lineAt(sel.head)
      if (sel.empty && line.length > 0 && sel.head === line.to) {
        const view = update.view
        queueMicrotask(() => {
          if (view.state.selection.main.head === sel.head) {
            view.dispatch({ selection: { anchor: sel.head - 1 } })
          }
        })
      }
    }
    if (mode !== lastVimMode) {
      lastVimMode = mode
      requestAnimationFrame(() => cm?.state.vimPlugin?.blockCursor?.scheduleRedraw())
    }
  })
}