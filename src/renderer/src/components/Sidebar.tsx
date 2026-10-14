import { forwardRef, useImperativeHandle, useState } from 'react'
import type { TreeNode } from '../types/workspace'
import { ContextMenu } from './ContextMenu'
import { ConfirmDialog } from './ConfirmDialog'
import { ExportDialog } from './ExportDialog'
import { FileTypeIcon } from './FileTypeIcon'
import { dirOf, fileNameOf } from '@renderer/utils/path'
import ChevronIcon from '../icons/chevron.svg?react'
import ExportIcon from '../icons/export.svg?react'
import NewFileIcon from '../icons/new-file.svg?react'
import NewFolderIcon from '../icons/new-folder.svg?react'
import { InlineNameInput, NewFileRow } from './sidebar/InlineInputs'
import { TreeRow, type RowContext } from './sidebar/TreeRow'
import { buildMenuItems } from './sidebar/sidebarMenu'
import { useTreeFocus } from './sidebar/useTreeFocus'
import { useTreeActions } from './sidebar/useTreeActions'

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null)
  const [exportTarget, setExportTarget] = useState<{
    folderPath: string
    isRoot: boolean
    label: string
  } | null>(null)
  useImperativeHandle(ref, () => ({
    startNewFile: (dirPath: string) => setNewFileIn(dirPath)
  }))

  const {
    rowRefs,
    isExpanded,
    toggleExpand,
    expandPath,
    registerRowRef,
    showRing,
    setShowRing,
    highlightOff,
    setHighlightOff,
    focusedPath,
    setFocusedPath,
    handleRowOpenFile,
    handleRowSelectFolder,
    visibleNodes,
    handleTreeKeyDown
  } = useTreeFocus({
    tree,
    rootDir,
    activeFilePath,
    selectedFolderPath,
    onOpenFile,
    onSelectFolder,
    onFocusEditor
  })

  const {
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
    handleDrop
  } = useTreeActions({
    visibleNodes,
    rowRefs,
    setFocusedPath,
    onEntryRenamed,
    onEntryMoved,
    onEntryDeleted,
    onFileCreated
  })

  const resolveToolbarDir = (): string | null => {
    if (selectedFolderPath) return selectedFolderPath
    if (activeFilePath) return dirOf(activeFilePath)
    return rootDir
  }

  const handleContextMenu = (e: React.MouseEvent, node: TreeNode): void => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
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
      onKeyDown={(e) => handleTreeKeyDown(e, openDeleteConfirm)}
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
