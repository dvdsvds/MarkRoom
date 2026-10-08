import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SHORTCUTS, type ShortcutAction, type ShortcutMap } from '../utils/shortcuts'

export type ThemePreference = 'system' | 'light' | 'dark'

const isMac = navigator.userAgent.includes('Mac')
const isWindows = navigator.userAgent.includes('Windows')

const DEFAULT_EDITOR_FONT_FAMILY = isMac
  ? "'SF Mono', Menlo, 'D2Coding', monospace"
  : isWindows
    ? "'Cascadia Code', Consolas, 'D2Coding', monospace"
    : "'DejaVu Sans Mono', 'D2Coding', monospace"

const DEFAULT_PREVIEW_FONT_FAMILY = isMac
  ? "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
  : isWindows
    ? "Pretendard, 'Segoe UI', 'Malgun Gothic', 'Noto Sans KR', sans-serif"
    : "Pretendard, 'Noto Sans KR', 'Noto Sans CJK KR', sans-serif"

interface SettingsState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void

  vimMode: boolean
  setVimMode: (value: boolean) => void
  vimMouse: boolean
  setVimMouse: (value: boolean) => void
  h1Warning: boolean
  setH1Warning: (value: boolean) => void

  editorFontFamily: string
  editorFontSize: number
  editorLineHeight: number
  setEditorFont: (partial: Partial<{ family: string; size: number; lineHeight: number }>) => void

  previewFontFamily: string
  previewFontSize: number
  previewLineHeight: number
  setPreviewFont: (partial: Partial<{ family: string; size: number; lineHeight: number }>) => void

  resetFonts: () => void
  resetEditorFont: () => void
  resetPreviewFont: () => void

  splitRatio: number
  setSplitRatio: (value: number) => void

  uiZoom: number
  setUiZoom: (value: number) => void

  showLineCol: boolean
  toggleShowLineCol: () => void
  showWordCount: boolean
  toggleShowWordCount: () => void
  showCharCount: boolean
  toggleShowCharCount: () => void
  charCountIncludeSpaces: boolean
  charCountExcludeSpaces: boolean
  toggleCharCountIncludeSpaces: () => void
  toggleCharCountExcludeSpaces: () => void

  shortcuts: ShortcutMap
  setShortcut: (action: ShortcutAction, combo: string) => void
  resetShortcut: (action: ShortcutAction) => void
  resetAllShortcuts: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      vimMode: false,
      setVimMode: (value) => set({ vimMode: value }),
      vimMouse: false,
      setVimMouse: (value) => set({ vimMouse: value }),
      h1Warning: true,
      setH1Warning: (value) => set({ h1Warning: value }),

      editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      editorFontSize: 14,
      editorLineHeight: 1.6,
      setEditorFont: (partial) =>
        set((state) => ({
          editorFontFamily: partial.family ?? state.editorFontFamily,
          editorFontSize: partial.size ?? state.editorFontSize,
          editorLineHeight: partial.lineHeight ?? state.editorLineHeight
        })),

      previewFontFamily: DEFAULT_PREVIEW_FONT_FAMILY,
      previewFontSize: 15,
      previewLineHeight: 1.7,
      setPreviewFont: (partial) =>
        set((state) => ({
          previewFontFamily: partial.family ?? state.previewFontFamily,
          previewFontSize: partial.size ?? state.previewFontSize,
          previewLineHeight: partial.lineHeight ?? state.previewLineHeight
        })),

      resetFonts: () =>
        set({
          editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
          editorFontSize: 12,
          editorLineHeight: 1.6,
          previewFontFamily: DEFAULT_PREVIEW_FONT_FAMILY,
          previewFontSize: 15,
          previewLineHeight: 1.7
        }),

      resetEditorFont: () =>
        set({
          editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
          editorFontSize: 12,
          editorLineHeight: 1.6
        }),
      resetPreviewFont: () =>
        set({
          previewFontFamily: DEFAULT_PREVIEW_FONT_FAMILY,
          previewFontSize: 15,
          previewLineHeight: 1.7
        }),

      splitRatio: 0.5,
      setSplitRatio: (value) => set({ splitRatio: Math.min(0.8, Math.max(0.2, value)) }),

      uiZoom: 100,
      setUiZoom: (value) =>
        set({ uiZoom: Math.min(200, Math.max(50, Math.round(value / 10) * 10)) }),

      showLineCol: true,
      toggleShowLineCol: () => set((state) => ({ showLineCol: !state.showLineCol })),
      showWordCount: false,
      toggleShowWordCount: () => set((state) => ({ showWordCount: !state.showWordCount })),
      showCharCount: false,
      toggleShowCharCount: () => set((state) => ({ showCharCount: !state.showCharCount })),
      charCountIncludeSpaces: true,
      charCountExcludeSpaces: true,
      toggleCharCountIncludeSpaces: () =>
        set((state) => ({ charCountIncludeSpaces: !state.charCountIncludeSpaces })),
      toggleCharCountExcludeSpaces: () =>
        set((state) => ({ charCountExcludeSpaces: !state.charCountExcludeSpaces })),

      shortcuts: DEFAULT_SHORTCUTS,
      setShortcut: (action, combo) =>
        set((state) => ({ shortcuts: { ...state.shortcuts, [action]: combo } })),
      resetShortcut: (action) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [action]: DEFAULT_SHORTCUTS[action] }
        })),
      resetAllShortcuts: () => set({ shortcuts: DEFAULT_SHORTCUTS })
    }),
    { name: 'syntaxnote-settings' }
  )
)
