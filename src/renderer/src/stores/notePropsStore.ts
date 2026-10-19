import { create } from 'zustand'
import { hasValue, type NoteProps, type PropValue } from '../utils/noteProperties'

interface NotePropsState {
  byPath: Record<string, NoteProps>
  load: () => Promise<void>
  setProps: (filePath: string, updates: Record<string, PropValue | null>) => void
  renameValue: (key: string, from: string, to: string | null) => void
  /** 모든 노트에서 이 속성의 값을 지운다 (속성 삭제, 타입 변경) */
  clearProperty: (key: string) => void
  countWithValue: (key: string, value?: string) => number
}

function persist(path: string, props: NoteProps): void {
  void window.api.props.set(path, props as Record<string, string>)
}

export const useNotePropsStore = create<NotePropsState>((set, get) => ({
  byPath: {},

  load: async () => {
    set({ byPath: (await window.api.props.getAll()) as Record<string, NoteProps> })
  },

  setProps: (filePath, updates) => {
    const next: NoteProps = { ...(get().byPath[filePath] ?? {}) }
    for (const [key, value] of Object.entries(updates)) {
      if (value !== null && hasValue(value)) next[key] = value
      else delete next[key]
    }
    set((s) => ({ byPath: { ...s.byPath, [filePath]: next } }))
    persist(filePath, next)
  },

  renameValue: (key, from, to) => {
    const updated: Record<string, NoteProps> = {}
    for (const [path, props] of Object.entries(get().byPath)) {
      const v = props[key]
      const next = { ...props }
      if (v === from) {
        if (to) next[key] = to
        else delete next[key]
      } else if (Array.isArray(v) && v.includes(from)) {
        // 여러 개 선택 값 안의 하나만 바꾸거나 뺀다
        const list = to ? v.map((x) => (x === from ? to : x)) : v.filter((x) => x !== from)
        if (list.length > 0) next[key] = [...new Set(list)]
        else delete next[key]
      } else continue
      updated[path] = next
      persist(path, next)
    }
    set((s) => ({ byPath: { ...s.byPath, ...updated } }))
  },

  clearProperty: (key) => {
    const updated: Record<string, NoteProps> = {}
    for (const [path, props] of Object.entries(get().byPath)) {
      if (!(key in props)) continue
      const next = { ...props }
      delete next[key]
      updated[path] = next
      persist(path, next)
    }
    set((s) => ({ byPath: { ...s.byPath, ...updated } }))
  },

  countWithValue: (key, value) =>
    Object.values(get().byPath).filter((p) => {
      const v = p[key]
      if (value === undefined) return hasValue(v)
      return v === value || (Array.isArray(v) && v.includes(value))
    }).length
}))
