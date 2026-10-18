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
  requestQuit: (onDone: () => void) => void 
  confirmSave: () => void
  confirmDiscard: () => void
  cancelClose: () => void
}

export function useTabClose(saveTab: (tabId: string) => Promise<void>): UseTabClose {
  const closeTab = useTabsStore((s) => s.closeTab)
  const [closeConfirm, setCloseConfirm] = useState<CloseConfirm | null>(null)
  const queueRef = useRef<string[]>([])
  const quitRef = useRef<(() => void) | null>(null)

  const askNext = useCallback((): void => {
    while (queueRef.current.length > 0) {
      const id = queueRef.current.shift() as string
      const tab = useTabsStore.getState().tabs.find((t) => t.id === id)
      if (!tab) continue
      if (!tab.dirty) {
        if (!quitRef.current) closeTab(id)
        continue
      }
      useTabsStore.getState().setActiveTab(id)
      setCloseConfirm({ tabId: id, title: tabLabel(tab) })
      return
    }
    setCloseConfirm(null)
    const onQuit = quitRef.current
    quitRef.current = null
    onQuit?.()
  }, [closeTab])

  const requestClose = useCallback(
    (tabId: string): void => {
      quitRef.current = null
      queueRef.current = [tabId]
      askNext()
    },
    [askNext]
  )

  const closeAll = useCallback((): void => {
    quitRef.current = null
    queueRef.current = useTabsStore.getState().tabs.map((t) => t.id)
    askNext()
  }, [askNext])

  const requestQuit = useCallback(
    (onDone: () => void): void => {
      quitRef.current = onDone
      queueRef.current = useTabsStore.getState().tabs.map((t) => t.id)
      askNext()
    },
    [askNext]
  )

  const confirmSave = useCallback((): void => {
    if (!closeConfirm) return
    const { tabId } = closeConfirm
    setCloseConfirm(null)
    void saveTab(tabId).then(() => {
      if (!quitRef.current) closeTab(tabId)
      askNext()
    })
  }, [closeConfirm, saveTab, closeTab, askNext])

  const confirmDiscard = useCallback((): void => {
    if (!closeConfirm) return
    if (!quitRef.current) closeTab(closeConfirm.tabId)
    askNext()
  }, [closeConfirm, closeTab, askNext])

  const cancelClose = useCallback((): void => {
    queueRef.current = []
    quitRef.current = null
    setCloseConfirm(null)
  }, [])

  return { closeConfirm, requestClose, requestQuit, closeAll, confirmSave, confirmDiscard, cancelClose }
}