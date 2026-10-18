import { useState } from 'react'
import type { TreeNode } from '../../types/workspace'
import { dirOf, fileNameOf, sepOf, splitName } from '@renderer/utils/path'
import { popUndo, pushUndo } from '@renderer/utils/sidebarUndo'
import { useToastStore } from '@renderer/stores/toastStore'

export interface DeleteTarget {
  node: TreeNode
  backlinks: { path: string; count: number }[] | null
  loading: boolean
}

export function useTreeActions({
  visibleNodes,
  rowRefs,
  setFocusedPath,
  onEntryRenamed,
  onEntryMoved,
  onEntryDeleted,
  onFileCreated
}: {
  visibleNodes: TreeNode[]
  rowRefs: React.RefObject<Map<string, HTMLButtonElement>>
  setFocusedPath: (path: string | null) => void
  onEntryRenamed: (oldPath: string, newPath: string) => void
  onEntryMoved: (oldPath: string, newPath: string) => void
  onEntryDeleted: (path: string) => void
  onFileCreated: (filePath: string) => void
}) {
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [newFolderIn, setNewFolderIn] = useState<string | null>(null)
  const [newFileIn, setNewFileIn] = useState<string | null>(null)
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  const commitRename = (node: TreeNode, rawValue: string): void => {
    const newName = node.type === 'file' ? `${rawValue}${splitName(node.name).ext}` : rawValue
    setEditingPath(null)
    if (newName === node.name) return
    window.api.workspace
      .renameEntry(node.path, newName)
      .then((newPath) => {
        pushUndo({ kind: 'rename', oldPath: node.path, newPath })
        onEntryRenamed(node.path, newPath)
      })
      .catch(() => {
        useToastStore
          .getState()
          .push({ kind: 'info', message: `'${newName}' 이름이 이미 있거나 바꿀 수 없어요.` })
      })
  }

  const commitNewFolder = (dirPath: string, name: string): void => {
    setNewFolderIn(null)
    const separator = sepOf(dirPath)
    void window.api.workspace.createFolder(dirPath, name).then(() => {
      setFocusedPath(`${dirPath}${separator}${name}`)
    })
  }

  const commitNewFile = (dirPath: string, rawTitle: string): void => {
    setNewFileIn(null)
    void window.api.workspace.createNote(dirPath, rawTitle).then((filePath) => {
      onFileCreated(filePath)
      setFocusedPath(filePath)
    })
  }

  const openDeleteConfirm = (node: TreeNode): void => {
    const isMd = node.type === 'file' && node.name.toLowerCase().endsWith('.md')
    setDeleteTarget({ node, backlinks: null, loading: isMd })
    if (isMd) {
      void window.api.workspace.findBacklinks(node.path).then((backlinks) => {
        setDeleteTarget({ node, backlinks, loading: false })
      })
    }
  }

  const confirmDelete = (): void => {
    if (!deleteTarget) return
    const { node } = deleteTarget
    const sep = sepOf(node.path)
    const idx = visibleNodes.findIndex((n) => n.path === node.path)
    const after = visibleNodes.slice(idx + 1).find((n) => !n.path.startsWith(node.path + sep))
    const neighbor = after ?? visibleNodes[idx - 1] ?? null
    void window.api.workspace.trash(node.path).then((trashId) => {
      pushUndo({ kind: 'delete', trashId })
      onEntryDeleted(node.path)
      const next = neighbor ? neighbor.path : null
      setFocusedPath(next)
      setTimeout(() => {
        if (next) rowRefs.current.get(next)?.focus()
      }, 50)
    })
    setDeleteTarget(null)
  }

  const handleDrop = (e: React.DragEvent, targetDirPath: string): void => {
    e.preventDefault()
    e.stopPropagation()
    const sourcePath = e.dataTransfer.getData('text/plain')
    setDraggingPath(null)
    if (!sourcePath) return
    if (dirOf(sourcePath) === targetDirPath) return
    void window.api.workspace.moveEntry(sourcePath, targetDirPath).then((newPath) => {
      pushUndo({ kind: 'move', oldPath: sourcePath, newPath })
      onEntryMoved(sourcePath, newPath)
    })
  }

  const undoLast = async (): Promise<void> => {
    const op = popUndo()
    if (!op) return
    const toast = useToastStore.getState().push
    try {
      if (op.kind === 'delete') {
        const restored = await window.api.workspace.restoreTrash(op.trashId)
        setFocusedPath(restored)
        toast({ kind: 'info', message: `${fileNameOf(restored)}을(를) 되돌렸어요.` })
      } else if (op.kind === 'rename') {
        const back = await window.api.workspace.renameEntry(op.newPath, fileNameOf(op.oldPath))
        onEntryRenamed(op.newPath, back)
        setFocusedPath(back)
      } else {
        const back = await window.api.workspace.moveEntry(op.newPath, dirOf(op.oldPath))
        onEntryMoved(op.newPath, back)
        if (fileNameOf(back) === fileNameOf(op.oldPath)) {
          setFocusedPath(back)
        } else {
          const renamed = await window.api.workspace.renameEntry(back, fileNameOf(op.oldPath))
          onEntryRenamed(back, renamed)
          setFocusedPath(renamed)
        }
      }
    } catch {
      toast({ kind: 'info', message: '되돌릴 수 없어요. 같은 이름이 이미 있거나 파일이 바뀌었어요.' })
    }
  }

  return {
    editingPath,
    setEditingPath,
    newFolderIn,
    setNewFolderIn,
    newFileIn,
    setNewFileIn,
    draggingPath,
    setDraggingPath,
    deleteTarget,
    setDeleteTarget,
    commitRename,
    commitNewFolder,
    commitNewFile,
    openDeleteConfirm,
    confirmDelete,
    handleDrop,
    undoLast
  }
}