import type { EditorView } from '@codemirror/view'

let current: EditorView | null = null

export function getCurrentView(): EditorView | null {
  return current
}

export function setCurrentView(view: EditorView | null): void {
  current = view
}