import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_SHORTCUTS, type ShortcutAction, type ShortcutMap } from '../utils/shortcuts'
import {
  CREATED_PROP_ID,
  DEFAULT_PROPERTY_DEFS,
  migrateLegacyOptions,
  type PropertyDef
} from '../utils/noteProperties'
import { DAILY_TEMPLATE_ID, DEFAULT_TEMPLATES, type NoteTemplate } from '../utils/noteTemplate'
import { DEFAULT_SNIPPETS, type CssSnippet } from '../utils/cssSnippets'

const OLD_DAILY_CONTENT =
  '# {{date:YYYY년 M월 D일 dddd}}\n\n← [[{{yesterday}}]] · [[{{tomorrow}}]] →\n\n## 오늘 할 일\n\n- [ ] \n\n## 메모\n\n'

export type ThemePreference = 'system' | 'light' | 'dark'
/** 사이드바 태그 섹션에서 묶어 보는 기준. 선택 타입 속성의 id */
export type TagGroupBy = string

const OLD_EDITOR_FONT_FAMILY = "'IBM Plex Mono', 'D2Coding', Pretendard, monospace"
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
  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void
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
  filesSectionOpen: boolean
  setFilesSectionOpen: (value: boolean) => void
  tagsSectionOpen: boolean
  setTagsSectionOpen: (value: boolean) => void
  collapsedFolders: string[]
  setFolderCollapsed: (path: string, collapsed: boolean) => void
  dailyFolder: string
  dailyFormat: string
  setDailyNote: (partial: Partial<{ folder: string; format: string }>) => void
  templates: NoteTemplate[]
  saveTemplate: (template: NoteTemplate) => void
  deleteTemplate: (id: string) => void
  templatesSectionOpen: boolean
  setTemplatesSectionOpen: (value: boolean) => void
  datesSectionOpen: boolean
  setDatesSectionOpen: (value: boolean) => void
  snippets: CssSnippet[]
  saveSnippet: (snippet: CssSnippet) => void
  deleteSnippet: (id: string) => void
  toggleSnippet: (id: string) => void
  tagGroupBy: TagGroupBy
  setTagGroupBy: (value: TagGroupBy) => void
  tagCollapsedGroups: Record<TagGroupBy, string[]>
  toggleTagGroup: (groupBy: TagGroupBy, label: string) => void
  propertyDefs: PropertyDef[]
  setPropertyDefs: (defs: PropertyDef[]) => void
  updatePropertyDef: (def: PropertyDef) => void
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
      showToolbar: false,
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
      sidebarCollapsed: false,
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value}),
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
      filesSectionOpen: true,
      setFilesSectionOpen: (value) => set({ filesSectionOpen: value }),
      tagsSectionOpen: true,
      setTagsSectionOpen: (value) => set({ tagsSectionOpen: value }),
      dailyFolder: '데일리',
      dailyFormat: 'YYYY-MM-DD',
      setDailyNote: (partial) =>
        set((state) => ({
          dailyFolder: partial.folder ?? state.dailyFolder,
          dailyFormat: partial.format ?? state.dailyFormat
        })),
      templates: DEFAULT_TEMPLATES,
      saveTemplate: (template) =>
        set((state) => ({
          templates: state.templates.some((t) => t.id === template.id)
            ? state.templates.map((t) => (t.id === template.id ? template : t))
            : [...state.templates, template]
        })),
      deleteTemplate: (id) =>
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
      templatesSectionOpen: true,
      setTemplatesSectionOpen: (value) => set({ templatesSectionOpen: value }),
      datesSectionOpen: true,
      setDatesSectionOpen: (value) => set({ datesSectionOpen: value }),
      snippets: DEFAULT_SNIPPETS,
      saveSnippet: (snippet) =>
        set((state) => ({
          snippets: state.snippets.some((s) => s.id === snippet.id)
            ? state.snippets.map((s) => (s.id === snippet.id ? snippet : s))
            : [...state.snippets, snippet]
        })),
      deleteSnippet: (id) => set((state) => ({ snippets: state.snippets.filter((s) => s.id !== id) })),
      toggleSnippet: (id) =>
        set((state) => ({
          snippets: state.snippets.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
        })),
      collapsedFolders: [],
      setFolderCollapsed: (path, collapsed) =>
        set((state) => {
          const has = state.collapsedFolders.includes(path)
          if (has === collapsed) return state
          return {
            collapsedFolders: collapsed
              ? [...state.collapsedFolders, path]
              : state.collapsedFolders.filter((p) => p !== path)
          }
        }),
      tagGroupBy: 'status',
      setTagGroupBy: (value) => set({ tagGroupBy: value }),
      tagCollapsedGroups: {},
      toggleTagGroup: (groupBy, label) =>
        set((state) => {
          const current = state.tagCollapsedGroups[groupBy] ?? []
          const next = current.includes(label)
            ? current.filter((l) => l !== label)
            : [...current, label]
          return { tagCollapsedGroups: { ...state.tagCollapsedGroups, [groupBy]: next } }
        }),
      propertyDefs: DEFAULT_PROPERTY_DEFS,
      setPropertyDefs: (defs) => set({ propertyDefs: defs }),
      updatePropertyDef: (def) =>
        set((state) => ({
          propertyDefs: state.propertyDefs.map((d) => (d.id === def.id ? def : d))
        })),
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
      version: 5,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>
        const defs = p.propertyDefs ?? current.propertyDefs
        return {
          ...current,
          ...p,
          shortcuts: { ...DEFAULT_SHORTCUTS, ...(p.shortcuts ?? {}) },
          tagCollapsedGroups: { ...current.tagCollapsedGroups, ...(p.tagCollapsedGroups ?? {}) },
          // 만든 날짜 속성은 앱이 기록하는 값이라 정의가 지워져 있어도 항상 둔다
          propertyDefs: defs.some((d) => d.id === CREATED_PROP_ID)
            ? defs
            : [...defs, DEFAULT_PROPERTY_DEFS[DEFAULT_PROPERTY_DEFS.length - 1]],
          // 사용자가 고치지 않은 예전 데일리 기본값(어제·내일 링크 줄 포함)은 새 기본값으로 바꾼다
          templates: (p.templates ?? current.templates).map((t) =>
            t.id === DAILY_TEMPLATE_ID && t.content === OLD_DAILY_CONTENT
              ? { ...t, content: DEFAULT_TEMPLATES[0].content }
              : t
          )
        }
      },
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
        if (version < 3) {
          s.showToolbar = false
        }
        const legacy = s as { propertyOptions?: Parameters<typeof migrateLegacyOptions>[0] }
        if (version < 4) {
          delete legacy.propertyOptions
        }
        if (version < 5) {
          // 상태·세부·중요도로 고정돼 있던 값 목록을 속성 정의로 옮긴다
          s.propertyDefs = migrateLegacyOptions(legacy.propertyOptions ?? {})
          delete legacy.propertyOptions
        }
        return s as SettingsState
      }
    }
  )
)
