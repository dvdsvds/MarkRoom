import { useCallback, useEffect, useRef } from 'react'
import { useTabsStore } from '../stores/tabsStore'
import { useToastStore } from '../stores/toastStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { readFileContent } from '../utils/fileKind'
import { fileNameOf } from '@renderer/utils/path'
import { useNotePropsStore } from '@renderer/stores/notePropsStore'

const EXTERNAL_CHANGE_BATCH_WINDOW_MS = 600

interface PendingChange {
  filePath: string
  title: string
  oldContent: string
  newContent: string
}

export function useWorkspaceEvents(): void {
  const setTree = useWorkspaceStore((s) => s.setTree)
  const syncExternalChange = useTabsStore((s) => s.syncExternalChange)
  const renamePath = useTabsStore((s) => s.renamePath)
  const markMissingByPath = useTabsStore((s) => s.markMissingByPath)
  const pushToast = useToastStore((s) => s.push)
  const bufferRef = useRef<PendingChange[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return window.api.workspace.onTreeChanged((newTree) => {
      setTree(newTree)
      void useNotePropsStore.getState().load()
    })
  }, [setTree])

  useEffect(() => {
    return window.api.workspace.onExternalNameSanitized((oldPath, newPath) => {
      renamePath(oldPath, newPath)
      const newName = fileNameOf(newPath)
      pushToast({
        kind: 'info',
        message: `사용할 수 없는 문자가 있어 파일 이름을 ${newName}"(으)로 변경했어요`
      })
    })
  }, [renamePath, pushToast])

  useEffect(() => {
    return window.api.workspace.onFileExternallyRemoved((filePath) => {
      markMissingByPath(filePath)
    })
  }, [markMissingByPath])

  const flushBuffer = useCallback((): void => {
    const items = bufferRef.current
    bufferRef.current = []
    if (items.length === 0) return
    if (items.length >= 3) {
      pushToast({
        kind: 'external-change-batch',
        message: `외부에서 변경된 파일 ${items.length}개를 다시 불러왔어요`,
        items
      })
    } else {
      for (const item of items) {
        pushToast({
          kind: 'external-change',
          message: `"${item.title}" 파일이 외부에서 변경되어 다시 불러왔어요`,
          filePath: item.filePath,
          oldContent: item.oldContent,
          newContent: item.newContent
        })
      }
    }
  }, [pushToast])

  useEffect(() => {
    return window.api.workspace.onFileChanged((changedPath) => {
      const priorTab = useTabsStore.getState().tabs.find((t) => t.filePath === changedPath)
      readFileContent(changedPath)
        .then((fresh) => {
          syncExternalChange(changedPath, fresh)
          if (!priorTab || !priorTab.dirty || priorTab.content === fresh) return
          bufferRef.current.push({
            filePath: changedPath,
            title: fileNameOf(changedPath),
            oldContent: priorTab.content,
            newContent: fresh
          })
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(flushBuffer, EXTERNAL_CHANGE_BATCH_WINDOW_MS)
        })
        .catch(() => {
          // 텍스트로 읽을 수 없게 바뀐 파일은 탭 내용을 덮어쓰지 않는다
        })
    })
  }, [syncExternalChange, flushBuffer])
}