import { useCallback, useRef, useState } from 'react'
import { useTabsStore } from '../stores/tabsStore'
import { tabLabel } from '../utils/tabLabel'

interface CloseConfirm {
  tabId: string
  title: string
}

interface UseTabClose {
  closeConfirm: CloseConfirm | null
  requestClose: (tabId: string) => void
  closeAll: () => void
  confirmSave: () => void
  confirmDiscard: () => void
  cancelClose: () => void
}

export function useTabClose(saveTab: (tabId: string) => Promise<void>): UseTabClose {
  const closeTab = useTabsStore((s) => s.closeTab)
  const [closeConfirm, setCloseConfirm] = useState<CloseConfirm | null>(null)
  const queueRef = useRef<string[]>([])

  const askNext = useCallback((): void => {
    while (queueRef.current.length > 0) {
      const id = queueRef.current.shift() as string
      const tab = useTabsStore.getState().tabs.find((t) => t.id === id)
      if (!tab) continue
      if (!tab.dirty) {
        closeTab(id)
        continue
      }
      useTabsStore.getState().setActiveTab(id)
      setCloseConfirm({ tabId: id, title: tabLabel(tab) })
      return
    }
    setCloseConfirm(null)
  }, [closeTab])

  const requestClose = useCallback(
    (tabId: string): void => {
      queueRef.current = [tabId]
      askNext()
    },
    [askNext]
  )

  const closeAll = useCallback((): void => {
    queueRef.current = useTabsStore.getState().tabs.map((t) => t.id)
    askNext()
  }, [askNext])

  const confirmSave = useCallback((): void => {
    if (!closeConfirm) return
    const { tabId } = closeConfirm
    setCloseConfirm(null)
    void saveTab(tabId).then(() => {
      closeTab(tabId)
      askNext()
    })
  }, [closeConfirm, saveTab, closeTab, askNext])

  const confirmDiscard = useCallback((): void => {
    if (!closeConfirm) return
    closeTab(closeConfirm.tabId)
    askNext()
  }, [closeConfirm, closeTab, askNext])

  const cancelClose = useCallback((): void => {
    queueRef.current = []
    setCloseConfirm(null)
  }, [])

  return { closeConfirm, requestClose, closeAll, confirmSave, confirmDiscard, cancelClose }
}