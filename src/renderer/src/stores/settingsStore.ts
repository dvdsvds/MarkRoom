import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SHORTCUTS, type ShortcutAction, type ShortcutMap } from '../utils/shortcuts'

export type ThemePreference = 'system' | 'light' | 'dark'

const OLD_EDITOR_FONT_FAMILY = "'IBM Plex Mono', 'D2Coding', Pretendard, monospace"
// 영문은 Roboto Mono, Roboto Mono에 없는 한글은 Pretendard가 맡는다.
const DEFAULT_EDITOR_FONT_FAMILY = "'Roboto Mono', Pretendard, monospace"
const DEFAULT_EDITOR_FONT_SIZE = 13.5
const DEFAULT_EDITOR_LINE_HEIGHT = 1.8
const DEFAULT_PREVIEW_FONT_FAMILY = 'Pretendard, sans-serif'

interface SettingsState {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void

  vimMode: boolean
  setVimMode: (value: boolean) => void
  vimMouse: boolean
  setVimMouse: (value: boolean) => void
  h1Warning: boolean
  setH1Warning: (value: boolean) => void
  showToolbar: boolean
  setShowToolbar: (value: boolean) => void

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
      showToolbar: true,
      setShowToolbar: (value) => set({ showToolbar: value }),

      editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
      editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
      editorLineHeight: DEFAULT_EDITOR_LINE_HEIGHT,
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
          editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
          editorLineHeight: DEFAULT_EDITOR_LINE_HEIGHT,
          previewFontFamily: DEFAULT_PREVIEW_FONT_FAMILY,
          previewFontSize: 15,
          previewLineHeight: 1.7
        }),

      resetEditorFont: () =>
        set({
          editorFontFamily: DEFAULT_EDITOR_FONT_FAMILY,
          editorFontSize: DEFAULT_EDITOR_FONT_SIZE,
          editorLineHeight: DEFAULT_EDITOR_LINE_HEIGHT
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
    {
      name: 'markroom-settings',
      version: 2,
      migrate: (persisted, version) => {
        const s = persisted as Partial<SettingsState>
        if (version < 1) {
          if (s.editorFontFamily === OLD_EDITOR_FONT_FAMILY) {
            s.editorFontFamily = DEFAULT_EDITOR_FONT_FAMILY
          }
          if (s.editorFontSize === 12 || s.editorFontSize === 14) {
            s.editorFontSize = DEFAULT_EDITOR_FONT_SIZE
          }
          if (s.editorLineHeight === 1.6) s.editorLineHeight = DEFAULT_EDITOR_LINE_HEIGHT
        }
        if (version < 2) {
          if (s.previewFontFamily?.includes('Source Serif')) {
            s.previewFontFamily = DEFAULT_PREVIEW_FONT_FAMILY
          }
        }
        return s as SettingsState
      }
    }
  )
)
