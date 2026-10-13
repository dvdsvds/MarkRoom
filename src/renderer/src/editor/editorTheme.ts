import { EditorView } from '@codemirror/view'

export const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: 'var(--editor-font-size)' },
  '.cm-content': {
    fontFamily: 'var(--font-editor)',
    fontWeight: '300',
    lineHeight: 'var(--editor-line-height)',
    caretColor: 'var(--color-accent)',
    paddingTop: '0px',
    paddingBottom: '0px'
  },
  '.cm-cursor, .cm-cursor-primary': {
    borderLeftColor: 'var(--color-text)',
    borderLeftWidth: '2px'
  },
  '&:not(.cm-focused) .cm-vimCursorLayer': {
    display: 'none !important'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--color-text-tertiary)',
    border: 'none',
    fontSize: '0.9em'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'flex-end'
  },
  '&.cm-focused': { outline: 'none' }
})