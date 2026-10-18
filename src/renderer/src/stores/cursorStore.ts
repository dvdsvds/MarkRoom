import { create } from 'zustand'

interface CursorState {
  line: number
  col: number
  setCursor: (pos: { line: number; col: number }) => void
}

// 커서는 키를 누를 때마다 바뀌어서, App 상태로 두면 화면 전체가 다시 그려진다.
// 상태 표시줄만 구독하도록 따로 둔다.
export const useCursorStore = create<CursorState>((set) => ({
  line: 1,
  col: 1,
  setCursor: (pos) => set({ line: pos.line, col: pos.col })
}))
