import { useEffect, useRef } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useTabsStore } from '../stores/tabsStore'
import { matchesShortcut } from '../utils/shortcuts'

export interface GlobalShortcutActions {
  settingsOpen: boolean
  save: () => void
  openSearch: () => void
  newFile: () => void
  toggleSettings: () => void
  closeSettings: () => void
  openOrFocusToc: () => void
  toggleTodo: () => void
  toggleBacklinks: () => void
}

function copyActivePath(e: KeyboardEvent, relative: boolean): void {
  const { tabs, activeTabId } = useTabsStore.getState()
  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab?.filePath) return
  e.preventDefault()
  void window.api.workspace.copyPath(tab.filePath, relative)
}

export function useGlobalShortcuts(actions: GlobalShortcutActions): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const a = actionsRef.current
      const { shortcuts, uiZoom, setUiZoom } = useSettingsStore.getState()

      if (matchesShortcut(e, shortcuts.save)) {
        e.preventDefault()
        a.save()
        return
      }
      if (matchesShortcut(e, shortcuts.search)) {
        e.preventDefault()
        a.openSearch()
        return
      }
      if (matchesShortcut(e, shortcuts.newNote)) {
        e.preventDefault()
        a.newFile()
        return
      }
      if (matchesShortcut(e, shortcuts.toggleSettings)) {
        e.preventDefault()
        a.toggleSettings()
        return
      }
      if (matchesShortcut(e, shortcuts.copyPathAbsolute)) {
        copyActivePath(e, false)
        return
      }
      if (matchesShortcut(e, shortcuts.copyPathRelative)) {
        copyActivePath(e, true)
        return
      }
      if (matchesShortcut(e, shortcuts.zoomIn)) {
        e.preventDefault()
        setUiZoom(uiZoom + 10)
        return
      }
      if (matchesShortcut(e, shortcuts.zoomOut)) {
        e.preventDefault()
        setUiZoom(uiZoom - 10)
        return
      }
      if (matchesShortcut(e, shortcuts.zoomReset)) {
        e.preventDefault()
        setUiZoom(100)
        return
      }
      if (matchesShortcut(e, shortcuts.toggleToc)) {
        e.preventDefault()
        a.openOrFocusToc()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault()
        a.toggleTodo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyB') {
        e.preventDefault()
        a.toggleBacklinks()
        return
      }
      if (e.key === 'Escape' && a.settingsOpen) {
        a.closeSettings()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const { uiZoom, setUiZoom } = useSettingsStore.getState()
      setUiZoom(uiZoom + (e.deltaY < 0 ? 10 : -10))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])
}