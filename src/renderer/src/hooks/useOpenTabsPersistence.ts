import { useEffect } from 'react'
import { useTabsStore } from '../stores/tabsStore'
import { fileKindOf, readFileContent } from '../utils/fileKind'

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
    const paths = (saved?.paths ?? []).filter(
      (path) => knownPaths.has(path) && fileKindOf(path) !== 'external'
    )
    // 전부 읽은 다음 한 번에 넣어야 탭을 하나씩 훑으며 그리지 않는다
    const files = await Promise.all(
      paths.map(async (filePath) => {
        try {
          return { filePath, content: await readFileContent(filePath) }
        } catch {
          // 그사이 바이너리로 바뀌었거나 너무 커진 파일은 복원하지 않는다
          return null
        }
      })
    )
    useTabsStore.getState().restoreTabs(
      files.filter((f): f is { filePath: string; content: string } => f !== null),
      saved?.activeTabId ?? null
    )
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