import { create } from 'zustand'

interface ExternalChangeToastItem {
  filePath: string
  title: string
  oldContent: string
  newContent: string
}

export type ToastItem =
  | {
      id: string
      kind: 'external-change'
      message: string
      filePath: string
      oldContent: string
      newContent: string
    }
  | {
      id: string
      kind: 'external-change-batch'
      message: string
      items: ExternalChangeToastItem[]
    }
  | {
      id: string
      kind: 'info'
      message: string
    }

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

interface ToastState {
  toasts: ToastItem[]
  push: (toast: DistributiveOmit<ToastItem, 'id'>) => void
  remove: (id: string) => void
  expandBatch: (id: string) => void
}

function makeId(): string {
  return crypto.randomUUID()
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => set((s) => ({ toasts: [...s.toasts, { ...toast, id: makeId() } as ToastItem] })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  expandBatch: (id) => {
    const target = get().toasts.find((t) => t.id === id)
    if (!target || target.kind !== 'external-change-batch') return
    const expanded: ToastItem[] = target.items.map((item) => ({
      id: makeId(),
      kind: 'external-change',
      message: `${item.title}이(가) 외부에서 변경되어 다시 불러왔어요. Ctrl+Z로 되돌릴 수 있어요`,
      filePath: item.filePath,
      oldContent: item.oldContent,
      newContent: item.newContent
    }))
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.id !== id), ...expanded] }))
  }
}))
