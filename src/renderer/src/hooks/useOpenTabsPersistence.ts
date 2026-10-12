import { useEffect } from 'react'
import { useTabsStore } from '../stores/tabsStore'
import { readFileContent } from '../utils/fileKind'

const STORAGE_KEY = 'markroom-open-tabs'
let restoreDone = false

interface SavedTabs {
  paths: string[]
  activeTabId: string | null
}

export async function restoreOpenTabs(knownPaths: Set<string>): Promise<void> {
  try {
    let saved: SavedTabs | null = null
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      saved = raw ? JSON.parse(raw) : null
    } catch {
      saved = null
    }
    const { openFile, setActiveTab } = useTabsStore.getState()
    for (const p of (saved?.paths ?? []).filter((path) => knownPaths.has(path))) {
      openFile(p, await readFileContent(p))
    }
    const activePath = saved?.activeTabId ?? null
    if (activePath) {
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === activePath)
      if (tab) setActiveTab(tab.id)
    }
  } finally {
    restoreDone = true
  }
}

export function usePersistOpenTabs(): void {
  const tabs = useTabsStore((s) => s.tabs)
  const activeTabId = useTabsStore((s) => s.activeTabId)

  useEffect(() => {
    if (!restoreDone) return
    const active = tabs.find((t) => t.id === activeTabId)
    const paths = tabs.filter((t) => t.filePath).map((t) => t.filePath as string)
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ paths, activeTabId: active?.filePath ?? null })
      )
    } catch {
      return
    }
  }, [tabs, activeTabId])
}