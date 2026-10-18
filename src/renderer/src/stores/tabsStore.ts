import { fileKindOf, type FileKind } from '@renderer/utils/fileKind'
import { create } from 'zustand'
import { sepOf } from '@renderer/utils/path'

export interface Tab {
  id: string
  filePath: string | null
  content: string
  dirty: boolean
  missing: boolean
  baseContent: string
  kind: FileKind
}

function makeId(): string {
  return crypto.randomUUID()
}

function insertAfterActive(tabs: Tab[], activeTabId: string | null, tab: Tab): Tab[] {
  const idx = tabs.findIndex((t) => t.id === activeTabId)
  if (idx === -1) return [...tabs, tab]
  return [...tabs.slice(0, idx + 1), tab, ...tabs.slice(idx + 1)]
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string | null
  recentTabIds: string[]

  openFile: (filePath: string, content: string) => void
  restoreTabs: (files: { filePath: string; content: string }[], activePath: string | null) => void
  setActiveTab: (tabId: string) => void
  setContent: (tabId: string, content: string) => void
  markSaved: (tabId: string, filePath: string, savedContent: string) => void
  closeTab: (tabId: string) => void
  syncExternalChange: (filePath: string, content: string) => void
  renamePath: (oldPath: string, newPath: string) => void
  rewriteWikilinks: (oldTitle: string, newTitle: string) => void
  markMissingByPath: (path: string) => void
}

function pushRecent(recentTabIds: string[], tabId: string): string[] {
  return [...recentTabIds.filter((id) => id !== tabId), tabId]
}

function makeTab(filePath: string, content: string): Tab {
  const kind = fileKindOf(filePath)
  const text = kind === 'text' ? content : ''
  return {
    id: makeId(),
    filePath,
    content: text,
    baseContent: text,
    kind,
    dirty: false,
    missing: false
  }
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  recentTabIds: [],

  openFile: (filePath, content) => {
    const existing = get().tabs.find((t) => t.filePath === filePath)
    if (existing) {
      set((s) => ({
        activeTabId: existing.id,
        recentTabIds: pushRecent(s.recentTabIds, existing.id)
      }))
      return
    }
    const tab = makeTab(filePath, content)
    set((s) => ({
      tabs: insertAfterActive(s.tabs, s.activeTabId, tab),
      activeTabId: tab.id,
      recentTabIds: pushRecent(s.recentTabIds, tab.id)
    }))
  },

  // 앱을 켤 때 저장해 둔 탭을 한 번에 넣는다. 활성 탭만 화면에 그려지게 한 번의 상태 변경으로 끝낸다.
  restoreTabs: (files, activePath) =>
    set((s) => {
      const known = new Set(s.tabs.map((t) => t.filePath))
      const added = files
        .filter((f) => !known.has(f.filePath))
        .map((f) => makeTab(f.filePath, f.content))
      if (added.length === 0) return s
      const tabs = [...s.tabs, ...added]
      const active =
        tabs.find((t) => t.filePath === activePath) ?? (s.activeTabId ? null : added[0])
      if (!active) return { tabs }
      return {
        tabs,
        activeTabId: active.id,
        recentTabIds: pushRecent(s.recentTabIds, active.id)
      }
    }),

  setActiveTab: (tabId) =>
    set((s) => ({ activeTabId: tabId, recentTabIds: pushRecent(s.recentTabIds, tabId) })),

  setContent: (tabId, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, content, dirty: true } : t))
    })),

  markSaved: (tabId, filePath, savedContent) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, filePath, dirty: t.content !== savedContent, missing: false } : t
      )
    })),

  closeTab: (tabId) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === tabId)
      if (idx === -1) return s
      const nextTabs = s.tabs.filter((t) => t.id !== tabId)
      const nextRecent = s.recentTabIds.filter((id) => id !== tabId)
      let nextActive = s.activeTabId
      if (s.activeTabId === tabId) {
        const remainingIds = new Set(nextTabs.map((t) => t.id))
        const previous = [...nextRecent].reverse().find((id) => remainingIds.has(id))
        nextActive = previous ?? nextTabs[idx]?.id ?? nextTabs[idx - 1]?.id ?? null
      }
      return { tabs: nextTabs, activeTabId: nextActive, recentTabIds: nextRecent }
    }),

  syncExternalChange: (filePath, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.filePath === filePath && t.kind === 'text' ? { ...t, content, dirty: false } : t
      )
    })),

  renamePath: (oldPath, newPath) =>
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.filePath === oldPath) return { ...t, filePath: newPath }
        if (t.filePath?.startsWith(oldPath + sepOf(oldPath))) {
          return { ...t, filePath: newPath + t.filePath.slice(oldPath.length) }
        }
        return t
      })
    })),

  rewriteWikilinks: (oldTitle, newTitle) => {
    const escaped = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`\\[\\[\\s*${escaped}\\s*\\]\\]`, 'g')
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (!t.filePath?.toLowerCase().endsWith('.md')) return t
        const content = t.content.replace(pattern, () => `[[${newTitle}]]`)
        return content === t.content ? t : { ...t, content }
      })
    }))
  },

  markMissingByPath: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.filePath === path ? { ...t, missing: true } : t))
    }))
}))
