import { Prec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'

export const listTabSpace: Extension = Prec.high(
  keymap.of([
    {
      key: 'Tab',
      run: (view) => {
        const pos = view.state.selection.main.head
        const line = view.state.doc.lineAt(pos)
        const beforeCursor = line.text.slice(0, pos - line.from)
        if (pos !== line.to || !/^\s*[-*+]$/.test(beforeCursor)) return false
        view.dispatch({
          changes: { from: pos, insert: ' ' },
          selection: { anchor: pos + 1 }
        })
        return true
      }
    }
  ])
)