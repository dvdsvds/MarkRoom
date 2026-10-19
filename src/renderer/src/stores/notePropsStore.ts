import { create } from 'zustand'
import type { NoteProps, PropertyKey } from '../utils/noteProperties'

interface NotePropsState {
  byPath: Record<string, NoteProps>
  load: () => Promise<void>
  setProps: (filePath: string, updates: Partial<Record<PropertyKey, string | null>>) => void
  renameValue: (key: PropertyKey, from: string, to: string | null) => void
}

export const useNotePropsStore = create<NotePropsState>((set, get) => ({
  byPath: {},

  load: async () => {
    set({ byPath: (await window.api.props.getAll()) as Record<string, NoteProps> })
  },

  setProps: (filePath, updates) => {
    const next: NoteProps = { ...(get().byPath[filePath] ?? {}) }
    for (const [key, value] of Object.entries(updates) as [PropertyKey, string | null][]) {
      if (value) next[key] = value
      else delete next[key]
    }
    set((s) => ({ byPath: { ...s.byPath, [filePath]: next } }))
    void window.api.props.set(filePath, next as Record<string, string>)
  },

  renameValue: (key, from, to) => {
    const updated: Record<string, NoteProps> = {}
    for (const [path, props] of Object.entries(get().byPath)) {
      if (props[key] !== from) continue
      const next = { ...props }
      if (to) next[key] = to
      else delete next[key]
      updated[path] = next
      void window.api.props.set(path, next as Record<string, string>)
    }
    set((s) => ({ byPath: { ...s.byPath, ...updated } }))
  }
}))
