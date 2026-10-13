import { ChangeSet, EditorState, type Extension } from '@codemirror/state'

function computeRenumberChanges(
  state: EditorState
): { from: number; to: number; insert: string }[] | null {
  const pos = state.selection.main.head
  const doc = state.doc
  const line = doc.lineAt(pos)
  const match = line.text.match(/^(\s*)(\d+)([.)])\s/)
  if (!match) return null
  const indent = match[1]

  let startLine = line.number
  while (startLine > 1) {
    const prev = doc.line(startLine - 1)
    const m = prev.text.match(/^(\s*)(\d+)([.)])\s/)
    if (!m || m[1] !== indent) break
    startLine--
  }
  let endLine = line.number
  while (endLine < doc.lines) {
    const next = doc.line(endLine + 1)
    const m = next.text.match(/^(\s*)(\d+)([.)])\s/)
    if (!m || m[1] !== indent) break
    endLine++
  }

  const first = doc.line(startLine).text.match(/^(\s*)(\d+)([.)])\s/)
  if (!first) return null
  let expected = parseInt(first[2], 10)
  const changes: { from: number; to: number; insert: string }[] = []
  for (let n = startLine; n <= endLine; n++) {
    const l = doc.line(n)
    const m = l.text.match(/^(\s*)(\d+)([.)])\s/)
    if (!m) continue
    const numStr = String(expected)
    if (m[2] !== numStr) {
      const from = l.from + m[1].length
      changes.push({ from, to: from + m[2].length, insert: numStr })
    }
    expected++
  }
  return changes.length > 0 ? changes : null
}

export function listRenumber(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || !tr.isUserEvent('delete')) return tr
    const renumber = computeRenumberChanges(tr.state)
    if (!renumber) return tr
    const combined = tr.changes.compose(ChangeSet.of(renumber, tr.changes.newLength))
    return { changes: combined }
  })
}