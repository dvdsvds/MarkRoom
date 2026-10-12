import { fileKindOf, type FileKind } from '@renderer/utils/fileKind'
import { create } from 'zustand'

export interface Tab {
  id: string
  filePath: string | null
  dirPath: string | null
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
  setActiveTab: (tabId: string) => void
  setContent: (tabId: string, content: string) => void
  markSaved: (tabId: string, filePath: string) => void
  closeTab: (tabId: string) => void
  syncExternalChange: (filePath: string, content: string) => void
  renamePath: (oldPath: string, newPath: string) => void
  markMissingByPath: (path: string) => void
}

function pushRecent(recentTabIds: string[], tabId: string): string[] {
  return [...recentTabIds.filter((id) => id !== tabId), tabId]
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
    const kind = fileKindOf(filePath)
    const text = kind === 'text' ? content : ''
    const tab: Tab = {
      id: makeId(),
      filePath,
      dirPath: null,
      content: text,
      baseContent: text,
      kind,
      dirty: false,
      missing: false
    }
    set((s) => ({
      tabs: insertAfterActive(s.tabs, s.activeTabId, tab),
      activeTabId: tab.id,
      recentTabIds: pushRecent(s.recentTabIds, tab.id)
    }))
  },

  setActiveTab: (tabId) =>
    set((s) => ({ activeTabId: tabId, recentTabIds: pushRecent(s.recentTabIds, tabId) })),

  setContent: (tabId, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, content, dirty: true } : t))
    })),

  markSaved: (tabId, filePath) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId ? { ...t, filePath, dirPath: null, dirty: false } : t
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
      tabs: s.tabs.map((t) => (t.filePath === oldPath ? { ...t, filePath: newPath } : t))
    })),

  markMissingByPath: (path) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.filePath === path ? { ...t, missing: true, dirty: false } : t))
    }))
}))
