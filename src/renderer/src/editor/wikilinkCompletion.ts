import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import type { NoteRef } from '../utils/noteIndex'

export function wikilinkCompletionSource(getNotes: () => NoteRef[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/\[\[[^\]\n]*/)
    if (!match) return null

    const query = match.text.slice(2).toLowerCase()
    const notes = getNotes()
    const options = notes
      .filter((n) => n.title.toLowerCase().includes(query))
      .slice(0, 20)
      .map((n) => ({ label: n.title, type: 'text', apply: n.title }))

    if (options.length === 0 && query.length === 0) return null

    return {
      from: match.from + 2,
      options,
      validFor: /^[^\]\n]*$/
    }
  }
}
