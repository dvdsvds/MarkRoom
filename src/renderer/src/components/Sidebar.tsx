import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { TreeNode } from '../types/workspace'
import { ContextMenu } from './ContextMenu'
import { ConfirmDialog } from './ConfirmDialog'
import { ExportDialog } from './ExportDialog'
import { FileTypeIcon } from './FileTypeIcon'
import { dirOf, fileNameOf, sepOf, splitName } from '@renderer/utils/path'
import ChevronIcon from '../icons/chevron.svg?react'
import ExportIcon from '../icons/export.svg?react'
import NewFileIcon from '../icons/new-file.svg?react'
import NewFolderIcon from '../icons/new-folder.svg?react'
import { InlineNameInput, NewFileRow } from './sidebar/InlineInputs'
import { TreeRow, findNodeByPath, type RowContext } from './sidebar/TreeRow'
import { buildMenuItems } from './sidebar/sidebarMenu'

interface SidebarProps {
  tree: TreeNode[]
  rootDir: string | null
  activeFilePath: string | null
  onOpenFile: (filePath: string) => void
  onEntryRenamed: (oldPath: string, newPath: string) => void
  onEntryMoved: (oldPath: string, newPath: string) => void
  onEntryDeleted: (path: string) => void
  onFileCreated: (filePath: string) => void
  onFocusEditor: () => void
  dirtyFilePaths: string[]
  onCompareChanges: (filePath: string) => void
  onOpenHistory: (filePath: string) => void
  onOpenAtLine: (filePath: string, line: number) => void
  selectedFolderPath: string | null
  onSelectFolder: (path: string | null) => void
  className?: string
  style?: React.CSSProperties
}

export interface SidebarHandle {
  startNewFile: (dirPath: string) => void
}

interface DeleteTarget {
  node: TreeNode
  backlinks: { path: string; count: number }[] | null
  loading: boolean
}

const ICON_BTN =
  'flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary'

export const Sidebar = forwardRef<SidebarHandle, SidebarProps>(function Sidebar(
  {
    tree,
    rootDir,
    activeFilePath,
    onOpenFile,
    onEntryRenamed,
    onEntryMoved,
    onEntryDeleted,
    onFileCreated,
    onFocusEditor,
    dirtyFilePaths,
    onCompareChanges,
    onOpenHistory,
    onOpenAtLine,
    selectedFolderPath,
    onSelectFolder,
    className,
    style
  }: SidebarProps,
  ref
) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(
    null
  )
  const [editingPath, setEditingPath] = useState<string | null>(null)
  const [newFolderIn, setNewFolderIn] = useState<string | null>(null)
  const [newFileIn, setNewFileIn] = useState<string | null>(null)
  const [draggingPath, setDraggingPath] = useState<string | null>(null)
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const isExpanded = (path: string): boolean => !collapsedPaths.has(path)
  const toggleExpand = (path: string): void => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }
  const expandPath = (path: string): void => {
    setCollapsedPaths((prev) => {
      if (!prev.has(path)) return prev
      const next = new Set(prev)
      next.delete(path)
      return next
    })
  }
  const registerRowRef = (path: string, el: HTMLButtonElement | null): void => {
    if (el) rowRefs.current.set(path, el)
    else rowRefs.current.delete(path)
  }
  const [showRing, setShowRing] = useState(false)
  const [highlightOff, setHighlightOff] = useState(false)
  const [prevActiveFilePath, setPrevActiveFilePath] = useState(activeFilePath)
  if (prevActiveFilePath !== activeFilePath) {
    setPrevActiveFilePath(activeFilePath)
    setHighlightOff(false)
  }
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  useEffect(() => {
    if (!focusedPath) return
    const el = rowRefs.current.get(focusedPath)
    const active = document.activeElement
    const focusIsFree = !active || active === document.body || active.tagName === 'BUTTON'
    if (el && focusIsFree && active !== el) {
      el.focus()
    }
  }, [focusedPath, tree])
  const handleRowOpenFile = (path: string): void => {
    setShowRing(false)
    setHighlightOff(false)
    setFocusedPath(path)
    rowRefs.current.get(path)?.focus()
    onOpenFile(path)
  }
  const handleRowSelectFolder = (path: string): void => {
    setFocusedPath(path)
    setHighlightOff(false)
    setFocusedPath(path)
    rowRefs.current.get(path)?.focus()
    onSelectFolder(path)
  }

  const visibleNodes = useMemo(() => {
    const result: TreeNode[] = []
    const walk = (nodes: TreeNode[]): void => {
      for (const n of nodes) {
        result.push(n)
        if (n.type === 'folder' && !collapsedPaths.has(n.path) && n.children) {
          walk(n.children)
        }
      }
    }
    walk(tree)
    return result
  }, [tree, collapsedPaths])

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [exportTarget, setExportTarget] = useState<{
    folderPath: string
    isRoot: boolean
    label: string
  } | null>(null)
  useImperativeHandle(ref, () => ({
    startNewFile: (dirPath: string) => setNewFileIn(dirPath)
  }))

  const handleTreeKeyDown = (e: React.KeyboardEvent): void => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
    if (e.key === 'Escape') {
      setFocusedPath(null)
      setHighlightOff(true)
      setShowRing(false)
      if (rootDir) onSelectFolder(rootDir)
      return
    }
    if (e.key === 'Delete') {
      const selectedPath = focusedPath ?? selectedFolderPath ?? activeFilePath
      if (!selectedPath) return
      const node = findNodeByPath(tree, selectedPath)
      if (!node) return
      openDeleteConfirm(node)
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      setShowRing(true)
      if (visibleNodes.length === 0) return
      e.preventDefault()
      const currentPath = focusedPath ?? selectedFolderPath ?? activeFilePath
      const currentIndex = currentPath ? visibleNodes.findIndex((n) => n.path === currentPath) : -1
      let nextIndex: number
      if (currentIndex === -1) {
        nextIndex = 0
      } else if (e.key === 'ArrowDown') {
        nextIndex = Math.min(currentIndex + 1, visibleNodes.length - 1)
      } else {
        nextIndex = Math.max(currentIndex - 1, 0)
      }
      const nextNode = visibleNodes[nextIndex]
      setFocusedPath(nextNode.path)
      rowRefs.current.get(nextNode.path)?.focus()
      return
    }

    if (e.key === 'Enter') {
      if (!focusedPath) return
      const node = findNodeByPath(tree, focusedPath)
      if (!node) return
      e.preventDefault()
      if (node.type === 'folder') {
        toggleExpand(node.path)
      } else {
        onOpenFile(node.path)
        onFocusEditor()
      }
    }
  }

  const commitRename = (node: TreeNode, rawValue: string): void => {
    const newName = node.type === 'file' ? `${rawValue}${splitName(node.name).ext}` : rawValue
    setEditingPath(null)
    if (newName === node.name) return
    void window.api.workspace.renameEntry(node.path, newName).then((newPath) => {
      onEntryRenamed(node.path, newPath)
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

  const resolveToolbarDir = (): string | null => {
    if (selectedFolderPath) return selectedFolderPath
    if (activeFilePath) return dirOf(activeFilePath)
    return rootDir
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
    void window.api.workspace.trash(node.path).then(() => {
      onEntryDeleted(node.path)
      const next = neighbor ? neighbor.path : null
      setFocusedPath(next)
      setTimeout(() => {
        if (next) rowRefs.current.get(next)?.focus()
      }, 50)
    })
    setDeleteTarget(null)
  }

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode): void => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const handleDrop = (e: React.DragEvent, targetDirPath: string): void => {
    e.preventDefault()
    e.stopPropagation()
    const sourcePath = e.dataTransfer.getData('text/plain')
    setDraggingPath(null)
    if (!sourcePath) return
    if (dirOf(sourcePath) === targetDirPath) return
    void window.api.workspace.moveEntry(sourcePath, targetDirPath).then((newPath) => {
      onEntryMoved(sourcePath, newPath)
    })
  }

  const ctx: RowContext = {
    activeFilePath,
    selectedFolderPath,
    highlightOff,
    showRing,
    dirtyFilePaths,
    editingPath,
    newFolderIn,
    newFileIn,
    draggingPath,
    isExpanded,
    onToggleExpand: toggleExpand,
    registerRowRef,
    focusedPath,
    onOpenFile: handleRowOpenFile,
    onSelectFolder: handleRowSelectFolder,
    onStartRename: (node) => setEditingPath(node.path),
    onCommitRename: commitRename,
    onCancelRename: () => setEditingPath(null),
    onCommitNewFolder: commitNewFolder,
    onCancelNewFolder: () => setNewFolderIn(null),
    onCommitNewFile: commitNewFile,
    onCancelNewFile: () => setNewFileIn(null),
    onContextMenu: handleContextMenu,
    onDragStart: (e, node) => {
      e.dataTransfer.setData('text/plain', node.path)
      e.dataTransfer.effectAllowed = 'move'
      setDraggingPath(node.path)
    },
    onDragEnd: () => setDraggingPath(null),
    onDrop: handleDrop
  }

  const menuItems = contextMenu
  ? buildMenuItems(contextMenu.node, {
      rootDir,
      dirtyFilePaths,
      expandPath,
      startNewFile: setNewFileIn,
      startNewFolder: setNewFolderIn,
      startRename: setEditingPath,
      openExport: setExportTarget,
      openDelete: openDeleteConfirm,
      onCompareChanges,
      onOpenHistory
    })
  : []

  return (
    <div
      tabIndex={-1}
      className={`group/sb flex flex-col outline-none ${className ?? ''}`}
      style={style}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => rootDir && handleDrop(e, rootDir)}
      onKeyDown={handleTreeKeyDown}
    >
      <div className="flex h-9 shrink-0 items-center justify-between pl-4 pr-2">
        <span className="text-[11px] font-medium tracking-wide text-text-tertiary">탐색</span>
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-focus-within/sb:opacity-100 group-hover/sb:opacity-100">
          <button
            type="button"
            onClick={() =>
              rootDir && setExportTarget({ folderPath: rootDir, isRoot: true, label: '전체' })
            }
            title="전체 내보내기"
            disabled={!rootDir}
            className={ICON_BTN}
          >
            <ExportIcon />
          </button>
          <button
            type="button"
            onClick={() => {
              const dir = resolveToolbarDir()
              if (dir) {
                expandPath(dir)
                setNewFolderIn(dir)
              }
            }}
            title="새 폴더"
            disabled={!rootDir}
            className={`${ICON_BTN} !w-[30px]`}
          >
            <NewFolderIcon />
          </button>
          <button
            type="button"
            onClick={() => {
              const dir = resolveToolbarDir()
              if (dir) {
                expandPath(dir)
                setNewFileIn(dir)
              }
            }}
            title="새 파일"
            disabled={!rootDir}
            className={ICON_BTN}
          >
            <NewFileIcon />
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-auto px-2 pb-2"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setFocusedPath(null)
            setHighlightOff(true)
            setShowRing(false)
            if (rootDir) onSelectFolder(rootDir)
            e.currentTarget.parentElement?.focus()
          }
        }}
      >
        {newFolderIn === rootDir && rootDir && (
          <div className="flex h-7 w-full items-center gap-2 pr-2" style={{ paddingLeft: 8 }}>
            <ChevronIcon
              width={12}
              height={12}
              style={{ width: 12, height: 12 }}
              className="shrink-0 opacity-0"
            />
            <FileTypeIcon name="" kind="folder" />
            <InlineNameInput
              initialValue=""
              onCommit={(value) => commitNewFolder(rootDir, value)}
              onCancel={() => setNewFolderIn(null)}
              paddingLeft={0}
              inline
            />
          </div>
        )}
        {newFileIn === rootDir && rootDir && (
          <NewFileRow
            paddingLeft={8 + 20}
            onCommit={(value) => commitNewFile(rootDir, value)}
            onCancel={() => setNewFileIn(null)}
          />
        )}
        {tree.map((node) => (
          <TreeRow key={node.path} node={node} depth={0} ctx={ctx} />
        ))}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="삭제할까요?"
          subject={{ name: deleteTarget.node.name, kind: deleteTarget.node.type }}
          message={
            deleteTarget.node.type === 'folder'
              ? '폴더 안의 모든 파일이 휴지통으로 이동돼요. 언제든 복원할 수 있어요'
              : deleteTarget.loading
                ? '링크를 확인하고 있어요…'
                : deleteTarget.backlinks && deleteTarget.backlinks.length > 0
                  ? `이 파일을 가리키는 위키링크가 ${deleteTarget.backlinks.reduce((sum, b) => sum + b.count, 0)}개 있어요. 삭제하면 링크가 끊겨요.`
                  : '휴지통으로 이동돼요. 언제든 복원할 수 있어요'
          }
          items={deleteTarget.backlinks?.map((b) => fileNameOf(b.path))}
          confirmLabel="삭제"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {exportTarget && (
        <ExportDialog
          folderPath={exportTarget.folderPath}
          isRoot={exportTarget.isRoot}
          folderLabel={exportTarget.label}
          onOpenLink={(path, line) => onOpenAtLine(path, line ?? 1)}
          onClose={() => setExportTarget(null)}
        />
      )}
    </div>
  )
})
