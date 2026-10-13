import { Annotation, EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { getCM } from '@replit/codemirror-vim'

let imeGuardUntil = 0
const imeRestore = Annotation.define<boolean>()

export function vimImeGuard(): Extension {
  return [
    EditorView.domEventHandlers({
      keydown: (e, view) => {
        const vs = getCM(view)?.state.vim
        if (vs && !vs.insertMode && (e.key === 'Process' || e.isComposing)) {
          const saved = view.state.selection
          imeGuardUntil = Date.now() + 200
          setTimeout(() => {
            if (view.state.selection.eq(saved)) {
              view.dispatch({ selection: saved, annotations: imeRestore.of(true) })
            }
          }, 120)
          e.preventDefault()
          return true
        }
        return false
      },
      beforeinput: (e, view) => {
        const vs = getCM(view)?.state.vim
        if (
          vs &&
          !vs.insertMode &&
          (e.inputType === 'deleteContentBackward' ||
            e.inputType === 'deleteCompositionText' ||
            e.inputType === 'insertText' ||
            e.inputType === 'insertCompositionText')
        ) {
          e.preventDefault()
          return true
        }
        return false
      }
    }),
    EditorState.transactionFilter.of((tr) =>
      (tr.docChanged || tr.selection) && Date.now() < imeGuardUntil && !tr.annotation(imeRestore)
        ? []
        : tr
    )
  ]
}