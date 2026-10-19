import { forwardRef, useImperativeHandle, useState } from 'react'
import type { TreeNode } from '../../types/workspace'
import { ContextMenu } from '../../components/ContextMenu'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ExportDialog } from '../export/ExportDialog'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { dirOf, fileNameOf, sepOf } from '@renderer/utils/path'
import ExportIcon from '../../icons/export.svg?react'
import NewFileIcon from '../../icons/new-file.svg?react'
import NewFolderIcon from '../../icons/new-folder.svg?react'
import ChevronIcon from '../../icons/chevron.svg?react'
import { InlineNameInput, NewFileRow } from './InlineInputs'
import { TreeRow, type RowContext } from './TreeRow'
import { buildMenuItems } from './sidebarMenu'
import { useTreeFocus } from './useTreeFocus'
import { useTreeActions, type DeleteTarget } from './useTreeActions'
import { TagSection } from './TagSection'
import { TemplateSection } from './TemplateSection'
import type { NoteTemplate } from '../../utils/noteTemplate'
import { useSettingsStore } from '@renderer/stores/settingsStore'

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
  onInsertTemplate: (template: NoteTemplate) => void
  onCreateFromTemplate: (template: NoteTemplate) => void
  className?: string
  style?: React.CSSProperties
}

export interface SidebarHandle {
  startNewFile: (dirPath: string) => void
}

function SectionHeader({
  label,
  open,
  onToggle
}: {
  label: string
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-[26px] items-center gap-1 rounded-md pl-1 pr-2 text-[11px] font-medium tracking-wide text-text-tertiary transition-colors hover:text-text-secondary"
    >
      <ChevronIcon
        width={12}
        height={12}
        className="shrink-0 transition-transform"
        style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
      />
      {label}
    </button>
  )
}

const ICON_BTN =
  'flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary'

function countDirtyUnder(dirtyFilePaths: string[], node: TreeNode): number {
  const prefix = node.path + sepOf(node.path)
  return dirtyFilePaths.filter((p) => p === node.path || p.startsWith(prefix)).length
}

function deleteMessage(target: DeleteTarget, dirtyCount: number): string {
  const parts: string[] = []
  if (dirtyCount > 0) {
    parts.push(
      target.node.type === 'folder'
        ? `저장 안 한 변경이 있는 파일이 ${dirtyCount}개 있어요. 되돌려도 이 변경은 돌아오지 않아요.`
        : '저장 안 한 변경이 있어요. 되돌려도 이 변경은 돌아오지 않아요.'
    )
  }
  if (target.node.type === 'folder') {
    if (dirtyCount === 0) {
      parts.push('폴더 안의 모든 파일이 앱 휴지통으로 이동돼요. Ctrl+Z로 되돌릴 수 있어요')
    }
  } else if (target.loading) {
    parts.push('링크를 확인하고 있어요…')
  } else if (target.backlinks && target.backlinks.length > 0) {
    const count = target.backlinks.reduce((sum, b) => sum + b.count, 0)
    parts.push(`이 파일을 가리키는 위키링크가 ${count}개 있어요. 삭제하면 링크가 끊겨요.`)
  } else if (dirtyCount === 0) {
    parts.push('앱 휴지통으로 이동돼요. Ctrl+Z로 되돌릴 수 있어요')
  }
  return parts.join(' ')
}

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
    onInsertTemplate,
    onCreateFromTemplate,
    className,
    style
  }: SidebarProps,
  ref
) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(
    null
  )
  const [exportTarget, setExportTarget] = useState<{
    folderPath: string
    isRoot: boolean
    label: string
  } | null>(null)
  const filesOpen = useSettingsStore((s) => s.filesSectionOpen)
  const setFilesOpen = useSettingsStore((s) => s.setFilesSectionOpen)
  const tagsOpen = useSettingsStore((s) => s.tagsSectionOpen)
  const setTagsOpen = useSettingsStore((s) => s.setTagsSectionOpen)
  const templatesOpen = useSettingsStore((s) => s.templatesSectionOpen)
  const setTemplatesOpen = useSettingsStore((s) => s.setTemplatesSectionOpen)

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
    handleDrop,
    undoLast
  } = useTreeActions({
    visibleNodes,
    rowRefs,
    setFocusedPath,
    onEntryRenamed,
    onEntryMoved,
    onEntryDeleted,
    onFileCreated
  })

  useImperativeHandle(ref, () => ({
    startNewFile: (dirPath: string) => setNewFileIn(dirPath)
  }))

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
      onKeyDown={(e) => handleTreeKeyDown(e, openDeleteConfirm, () => void undoLast())}
    >
      <div className={`flex min-h-0 flex-col ${filesOpen ? 'flex-1' : 'shrink-0'}`}>
        <div className="flex h-9 shrink-0 items-center justify-between pl-2 pr-2">
          <SectionHeader label="파일" open={filesOpen} onToggle={() => setFilesOpen(!filesOpen)} />
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
        {filesOpen && (
          <div
            className="flex-1 overflow-auto px-2 pb-2"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setFocusedPath(null)
                setHighlightOff(true)
                setShowRing(false)
                if (rootDir) onSelectFolder(rootDir)
                e.currentTarget.parentElement?.parentElement?.focus()
              }
            }}
          >
            {newFolderIn === rootDir && rootDir && (
              <div className="flex h-7 w-full items-center gap-2 pr-2" style={{ paddingLeft: 8 }}>
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
                paddingLeft={8}
                onCommit={(value) => commitNewFile(rootDir, value)}
                onCancel={() => setNewFileIn(null)}
              />
            )}
            {tree.map((node) => (
              <TreeRow key={node.path} node={node} depth={0} ctx={ctx} />
            ))}
          </div>
        )}
      </div>
      <div
        className={`flex min-h-0 flex-col border-t border-border ${tagsOpen ? 'flex-1' : 'shrink-0'}`}
      >
        <div className="flex h-9 shrink-0 items-center pl-2 pr-2">
          <SectionHeader label="태그" open={tagsOpen} onToggle={() => setTagsOpen(!tagsOpen)} />
        </div>
        {tagsOpen && (
          <div className="flex-1 overflow-auto pb-2">
            <TagSection tree={tree} activeFilePath={activeFilePath} onOpenFile={onOpenFile} />
          </div>
        )}
      </div>
      <div
        className={`flex min-h-0 flex-col border-t border-border ${templatesOpen ? 'flex-1' : 'shrink-0'}`}
      >
        <div className="flex h-9 shrink-0 items-center pl-2 pr-2">
          <SectionHeader
            label="템플릿"
            open={templatesOpen}
            onToggle={() => setTemplatesOpen(!templatesOpen)}
          />
        </div>
        {templatesOpen && (
          <div className="flex-1 overflow-auto pb-2">
            <TemplateSection onInsert={onInsertTemplate} onCreateNote={onCreateFromTemplate} />
          </div>
        )}
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
          message={deleteMessage(deleteTarget, countDirtyUnder(dirtyFilePaths, deleteTarget.node))}
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