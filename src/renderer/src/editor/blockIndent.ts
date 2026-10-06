import { Prec, type Text } from '@codemirror/state'
import { keymap } from '@codemirror/view'

const OPEN_BRACE = /^(\s*)(table|chart)\s*\{$/
const OPEN_BRACKET = /^(\s*)(template|value|box|table|grid=\d{1,2}(?:\s+(?:frame|widths)=\S+)*)\s*\[$/
const COL_DEF = /^\s*(?:col|row)=\d/

const indentOf = (s: string): number => s.length - s.trimStart().length

function ownerDef(doc: Text, lineNo: number, ci: number): string | null {
  if (ci === 0) return null
  for (let n = lineNo - 1, steps = 0; n >= 1 && steps < 80; n--, steps++) {
    const t = doc.line(n).text
    if (t.trim() === '') continue
    if (indentOf(t) < ci) return COL_DEF.test(t) ? t : null
  }
  return null
}

export const blockIndent = Prec.high(
  keymap.of([
    {
      key: 'Enter',
      run: (view) => {
        if (view.composing) return false
        const sel = view.state.selection.main
        if (!sel.empty) return false
        const doc = view.state.doc
        const line = doc.lineAt(sel.head)
        const before = line.text.slice(0, sel.head - line.from)
        const after = line.text.slice(sel.head - line.from)

        if (after.trim() === '' && COL_DEF.test(before)) {
          const base = /^\s*/.exec(before)?.[0] ?? ''
          const insert = '\n' + base + '  '
          view.dispatch({
            changes: { from: sel.head, to: line.to, insert },
            selection: { anchor: sel.head + insert.length },
            userEvent: 'input'
          })
          return true
        }

        if (line.text.trim() === '' && after.trim() === '') {
          const owner = ownerDef(doc, line.number, line.text.length)
          if (owner !== null) {
            const base = /^\s*/.exec(owner)?.[0] ?? ''
            view.dispatch({
              changes: { from: line.from, to: line.to, insert: base },
              selection: { anchor: line.from + base.length },
              userEvent: 'input'
            })
            return true
          }
        }

        if (line.text.trim() !== '' && ownerDef(doc, line.number, indentOf(line.text)) !== null) {
          const base = /^\s*/.exec(line.text)?.[0] ?? ''
          const insert = '\n' + base
          view.dispatch({
            changes: { from: sel.head, insert },
            selection: { anchor: sel.head + insert.length },
            userEvent: 'input'
          })
          return true
        }

        let closer: string | null = null
        let m = OPEN_BRACE.exec(before)
        if (m) closer = '}'
        else {
          m = OPEN_BRACKET.exec(before)
          if (m) closer = ']'
        }
        if (!m || !closer) return false

        const base = m[1]
        const inner = base + '  '
        const closed = after.trim() === closer
        if (after.trim() !== '' && !closed) return false

        const insert = closed ? '\n' + inner + '\n' + base : '\n' + inner
        view.dispatch({
          changes: { from: sel.head, insert },
          selection: { anchor: sel.head + 1 + inner.length },
          userEvent: 'input'
        })
        return true
      }
    }
  ])
)