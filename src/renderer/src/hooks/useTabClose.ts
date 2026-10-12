import { useCallback, useState } from 'react'
import { useTabsStore } from '../stores/tabsStore'
import { tabLabel } from '../utils/tabLabel'

interface CloseConfirm {
  tabId: string
  title: string
}

interface UseTabClose {
  closeConfirm: CloseConfirm | null
  requestClose: (tabId: string) => void
  closeOthers: (tabId: string) => void
  closeToRight: (tabId: string) => void
  closeAll: () => void
  confirmSave: () => void
  confirmDiscard: () => void
  cancelClose: () => void
}

/** 탭 닫기. 저장 안 된 내용이 있으면 저장 / 저장 안 함 / 취소를 먼저 묻는다. */
export function useTabClose(saveTab: (tabId: string) => Promise<void>): UseTabClose {
  const closeTab = useTabsStore((s) => s.closeTab)
  const [closeConfirm, setCloseConfirm] = useState<CloseConfirm | null>(null)

  const requestClose = useCallback(
    (tabId: string): void => {
      const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId)
      if (!tab) return
      if (!tab.dirty) {
        closeTab(tabId)
        return
      }
      setCloseConfirm({ tabId, title: tabLabel(tab) })
    },
    [closeTab]
  )

  const closeOthers = useCallback(
    (tabId: string): void => {
      for (const tab of useTabsStore.getState().tabs) {
        if (tab.id !== tabId) requestClose(tab.id)
      }
    },
    [requestClose]
  )

  const closeToRight = useCallback(
    (tabId: string): void => {
      const allTabs = useTabsStore.getState().tabs
      const idx = allTabs.findIndex((t) => t.id === tabId)
      if (idx === -1) return
      for (const tab of allTabs.slice(idx + 1)) requestClose(tab.id)
    },
    [requestClose]
  )

  const closeAll = useCallback((): void => {
    for (const tab of useTabsStore.getState().tabs) requestClose(tab.id)
  }, [requestClose])

  const confirmSave = useCallback((): void => {
    if (!closeConfirm) return
    const { tabId } = closeConfirm
    setCloseConfirm(null)
    void saveTab(tabId).then(() => closeTab(tabId))
  }, [closeConfirm, saveTab, closeTab])

  const confirmDiscard = useCallback((): void => {
    if (!closeConfirm) return
    closeTab(closeConfirm.tabId)
    setCloseConfirm(null)
  }, [closeConfirm, closeTab])

  const cancelClose = useCallback((): void => setCloseConfirm(null), [])

  return {
    closeConfirm,
    requestClose,
    closeOthers,
    closeToRight,
    closeAll,
    confirmSave,
    confirmDiscard,
    cancelClose
  }
}