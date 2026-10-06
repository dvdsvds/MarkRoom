import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { TreeNode } from '../types/workspace'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { ConfirmDialog } from './ConfirmDialog'
import { ExportDialog } from './ExportDialog'
import ChevronIcon from '../icons/chevron.svg?react'
import ExportIcon from '../icons/export.svg?react'
import FileIcon from '../icons/file.svg?react'
import FolderIcon from '../icons/folder.svg?react'
import NewFileIcon from '../icons/new-file.svg?react'
import NewFolderIcon from '../icons/new-folder.svg?react'

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
  selectedFolderPath: string | null
  onSelectFolder: (path: string) => void
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

interface RowContext {
  activeFilePath: string | null
  selectedFolderPath: string | null
  dirtyFilePaths: string[]
  editingPath: string | null
  newFolderIn: string | null
  newFileIn: string | null
  draggingPath: string | null
  isExpanded: (path: string) => boolean
  onToggleExpand: (path: string) => void
  registerRowRef: (path: string, el: HTMLButtonElement | null) => void
  focusedPath: string | null
  onOpenFile: (filePath: string) => void
  onSelectFolder: (path: string) => void
  onStartRename: (node: TreeNode) => void
  onCommitRename: (node: TreeNode, newName: string) => void
  onCancelRename: () => void
  onCommitNewFolder: (dirPath: string, name: string) => void
  onCancelNewFolder: () => void
  onCommitNewFile: (dirPath: string, name: string) => void
  onCancelNewFile: () => void
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void
  onDragStart: (e: React.DragEvent, node: TreeNode) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent, targetDirPath: string) => void
}

function dirOf(filePath: string): string {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return idx >= 0 ? filePath.slice(0, idx) : filePath
}

function findNodeByPath(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
      if (node.path === path) return node
      if (node.children) {
        const found = findNodeByPath(node.children, path)
        if (found) return found
      }
  }
  return null
}

function nameWithoutExt(node: TreeNode): string {
  return node.type === 'file' && node.name.toLowerCase().endsWith('.md')
    ? node.name.slice(0, -3)
    : node.name
}

function InlineNameInput({
  initialValue,
  onCommit,
  onCancel,
  paddingLeft,
  inline = false
}: {
  initialValue: string
  onCommit: (value: string) => void
  onCancel: () => void
  paddingLeft: number
  inline?: boolean
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const trimmed = value.trim()
          if (trimmed.length > 0) onCommit(trimmed)
          else onCancel()
        } else if (e.key === 'Escape') {
          onCancel()
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className={
        inline
          ? '-ml-px relative min-w-0 flex-1 rounded border border-accent bg-bg px-0 py-0 leading-none text-xs text-text outline-none'
          : 'my-0.5 w-[calc(100%-8px)] rounded border border-accent bg-bg px-1.5 py-0.5 text-sm text-text outline-none'
      }
      style={inline ? { top: '0px' } : { marginLeft: paddingLeft }}
    />
  )
}

function TreeRow({
  node,
  depth,
  ctx
}: {
  node: TreeNode
  depth: number
  ctx: RowContext
}): React.JSX.Element {
  const expanded = ctx.isExpanded(node.path)
  const paddingLeft = 6 + depth * 9

    if (node.type === 'folder') {
    return (
      <div>
        <div
          draggable
          onDragStart={(e) => ctx.onDragStart(e, node)}
          onDragEnd={ctx.onDragEnd}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => ctx.onDrop(e, node.path)}
          onContextMenu={(e) => ctx.onContextMenu(e, node)}
          className={`flex items-center ${ctx.draggingPath === node.path ? 'opacity-40' : ''}`}
        >
          {ctx.editingPath === node.path ? (
            <div
              className="flex h-6 w-full items-center gap-1.5 rounded px-2 text-xs"
              style={{ paddingLeft }}
            >
              <ChevronIcon
                width={12}
                height={12}
                style={{ width: 12, height: 12, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                className="shrink-0 text-text-secondary transition-transform"
              />
              <FolderIcon width={16} height={16} className="shrink-0 text-text-secondary"/>
              <InlineNameInput
                initialValue={node.name}
                onCommit={(value) => ctx.onCommitRename(node, value)}
                onCancel={ctx.onCancelRename}
                paddingLeft={paddingLeft}
                inline
              />
            </div>
          ) : (
            <button
              ref={(el) => ctx.registerRowRef(node.path, el)}
              type="button"
              onClick={() => {
                ctx.onToggleExpand(node.path)
                ctx.onSelectFolder(node.path)
              }}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-bg-mute focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${
                ctx.selectedFolderPath === node.path
                  ? 'bg-bg-mute text-text'
                  : 'text-text-secondary'
              }`}
              style={{ paddingLeft }}
            >
              <ChevronIcon width={12} height={12} className="shrink-0 text-text-secondary transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}/>
              <FolderIcon width={16} height={16} style={{ width: 16, height: 16 }} className="shrink-0 text-text-secondary"/>
              <span className="truncate">{node.name}</span>
            </button>
          )}
        </div>
        {expanded && (
          <div>
            {ctx.newFolderIn === node.path && (
              <div
                className="flex h-6 w-full items-center gap-1.5 rounded px-2 text-xs" 
                style={{ paddingLeft: paddingLeft + 14 }}
              >
                <ChevronIcon width={12} height={12} style={{ width: 12, height: 12 }} className="shrink-0 opacity-0"/>
                <FolderIcon width={16} height={16} style={{ width: 16, height: 16 }} className="shrink-0 text-text-secondary" />
                <InlineNameInput
                  initialValue=""
                  onCommit={(value) => ctx.onCommitNewFolder(node.path, value)}
                  onCancel={ctx.onCancelNewFolder}
                  paddingLeft={0}
                />
              </div>
            )}
            {ctx.newFileIn === node.path && (
              <div
                className="flex h-6 w-full items-center gap-1.5 rounded px-2 text-xs"
                style={{ paddingLeft: paddingLeft + 27 }}
              >
                <FileIcon width={16} height={16} style={{ width: 16, height: 16 }} className="shrink-0 text-text-secondary"/>
                <InlineNameInput
                  initialValue=""
                  onCommit={(value) => ctx.onCommitNewFile(node.path, value)}
                  onCancel={ctx.onCancelNewFile}
                  paddingLeft={0}
                  inline
                />
              </div>
            )}
            {node.children?.map((child) => (
              <TreeRow key={child.path} node={child} depth={depth + 1} ctx={ctx} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (ctx.editingPath === node.path) {
    return (
      <div
        className="flex h-6 w-full items-center gap-1.5 rounded px-2 text-xs"
        style={{ paddingLeft: paddingLeft + 18}}
      >
        <FileIcon width={16} height={16} style={{ width: 16, height: 16 }} className="shrink-0 text-text-secondary" />
        <InlineNameInput
          initialValue={nameWithoutExt(node)}
          onCommit={(value) => ctx.onCommitRename(node, value)}
          onCancel={ctx.onCancelRename}
          paddingLeft={0}
          inline
        />

      </div>
    )
  }

  const isActive = node.path === ctx.activeFilePath && !ctx.selectedFolderPath
  const isDirty = ctx.dirtyFilePaths.includes(node.path)
  return (
    <button
      ref={(el) => ctx.registerRowRef(node.path, el)}
      type="button"
      draggable
      onDragStart={(e) => ctx.onDragStart(e, node)}
      onDragEnd={ctx.onDragEnd}
      onContextMenu={(e) => ctx.onContextMenu(e, node)}
      onClick={() => ctx.onOpenFile(node.path)}
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-bg-mute focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${
        isActive ? 'bg-bg-mute' : ''
      } ${isDirty ? 'text-yellow-500' : isActive ? 'text-text' : 'text-text-secondary'} ${
        ctx.draggingPath === node.path ? 'opacity-40' : ''
      }`}
      style={{ paddingLeft: paddingLeft + 18 }}
    >
      <FileIcon width={16} height={16} className="shrink-0 text-text-secondary" />
      <span className="truncate">{node.name}</span>
      {isDirty && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500/40" />}
    </button>
  )
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
  const [focusedPath, setFocusedPath] = useState<string | null>(null)
  useEffect(() => {
    if(!focusedPath) return
    const el = rowRefs.current.get(focusedPath)
    const active = document.activeElement
    const focusIsFree = !active || active === document.body || active.tagName === 'BUTTON'
    if (el && focusIsFree && active !== el) {
      el.focus()
    }
  }, [focusedPath, tree])
  const handleRowOpenFile = (path: string): void => {
    setFocusedPath(path)
    rowRefs.current.get(path)?.focus()
    onOpenFile(path)
  }
  const handleRowSelectFolder = (path: string): void => {
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

    if (e.key === 'Delete') {
      const selectedPath = focusedPath ?? selectedFolderPath ?? activeFilePath
      if (!selectedPath) return
      const node = findNodeByPath(tree, selectedPath)
      if (!node) return
      openDeleteConfirm(node)
      return
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
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
    const newName = node.type === 'file' ? `${rawValue}.md` : rawValue
    setEditingPath(null)
    if (newName === node.name) return
    void window.api.workspace.renameEntry(node.path, newName).then((newPath) => {
      onEntryRenamed(node.path, newPath)
    })
  }

  const commitNewFolder = (dirPath: string, name: string): void => {
    setNewFolderIn(null)
    const separator = dirPath.includes('\\') ? '\\' : '/'
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
    setDeleteTarget({ node, backlinks: null, loading: node.type === 'file' })
    if (node.type === 'file' && node.name.toLowerCase().endsWith('.md')) {
      void window.api.workspace.findBacklinks(node.path).then((backlinks) => {
        setDeleteTarget({ node, backlinks, loading: false })
      })
    }
  }

  const confirmDelete = (): void => {
    if (!deleteTarget) return
    const { node } = deleteTarget
    const sep = node.path.includes('\\') ? '\\' : '/'
    const idx = visibleNodes.findIndex((n) => n.path === node.path)
    const after = visibleNodes
      .slice(idx + 1)
      .find((n) => !n.path.startsWith(node.path + sep))
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

  const menuItems: ContextMenuItem[] = contextMenu
    ? (() => {
        const node = contextMenu.node
        const items: ContextMenuItem[] = []
        if (node.type === 'folder') {
          items.push({ 
            label: '새 메모', 
            onClick: () => {
              expandPath(node.path)
              setNewFileIn(node.path) 
            }
          })
          items.push({ 
            label: '새 폴더', 
            onClick: () => {
              expandPath(node.path)
              setNewFolderIn(node.path) 
            }
          })
        }
        items.push({ label: '이름 바꾸기', onClick: () => setEditingPath(node.path) })
        items.push({
          label: '경로 복사',
          onClick: () => void window.api.workspace.copyPath(node.path, false)
        })
        items.push({
          label: '상대 경로 복사',
          onClick: () => void window.api.workspace.copyPath(node.path, true)
        })
        items.push({
          label: '폴더에서 보기',
          onClick: () => void window.api.workspace.reveal(node.path)
        })
        if (node.type === 'folder') {
          items.push({
            label: '폴더 내보내기',
            onClick: () =>
              setExportTarget({
                folderPath: node.path,
                isRoot: rootDir !== null && node.path === rootDir,
                label: node.name
              })
          })
        }
        if (
          node.type === 'file' &&
          node.name.toLowerCase().endsWith('.md') &&
          dirtyFilePaths.includes(node.path)
        ) {
          items.push({
            label: '변경 내용 비교',
            onClick: () => onCompareChanges(node.path)
          })
        }
        if (node.type === 'file' && node.name.toLowerCase().endsWith('.md')) {
          items.push({ label: '버전 기록', onClick: () => onOpenHistory(node.path)})
        }
        items.push({ label: '삭제', danger: true, onClick: () => openDeleteConfirm(node) })
        return items
      })()
    : []

  return (
    <div
      tabIndex={-1}
      className={`flex flex-col bg-bg-soft outline-none ${className ?? ''}`}
      style={style}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => rootDir && handleDrop(e, rootDir)}
      onKeyDown={handleTreeKeyDown}
    >
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-border pl-2 pr-0">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">탐색</span>
        <div className="flex items-center gap-0">
        <button
          type="button"
          onClick={() =>
            rootDir && setExportTarget({ folderPath: rootDir, isRoot: true, label: '전체' })
          }
          title="전체 내보내기"
          disabled={!rootDir}
          className="flex items-center justify-center rounded px-1.5 text-text-secondary hover:bg-bg-mute hover:text-text disabled:opacity-40"
        >
          <ExportIcon width={16} height={16}/>
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
          className="flex items-center justify-center rounded px-1.5 text-text-secondary hover:bg-bg-mute hover:text-text disabled:opacity-40"
        >
          <NewFolderIcon width={16} height={16}/>
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
          className="flex items-center justify-center rounded px-1.5 text-text-secondary hover:bg-bg-mute hover:text-text disabled:opacity-40"
        >
          <NewFileIcon/>
        </button>
      </div>
      </div>
      <div className="flex-1 overflow-auto px-1.5 pt-1.5 pb-2">
        {newFolderIn === rootDir && rootDir && (
          <div className="flex h-6 w-full items-center gap-1.5 rounded px-2 text-xs" style={{ paddingLeft: 12 }}>
            <ChevronIcon width={10} height={10} style={{ width:10, height:10 }} className="shrink-0 opacity-0"/>
            <FolderIcon width={16} height={14} style={{ width:16, height: 14 }} className="shrink-0 text-text-secondary"/>
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
          <div className="flex h-6 w-full items-center gap-1.5 rounded px-2 text-xs" style={{ paddingLeft: 6 + 18 }}>
            <FileIcon width={16} height={14} style={{ width:16, height: 14}} className="shrink-0 text-text-secondary"/>
            <InlineNameInput
              initialValue=""
              onCommit={(value) => commitNewFile(rootDir, value)}
              onCancel={() => setNewFileIn(null)}
              paddingLeft={0}
              inline
            />
          </div>
        )}
        {tree.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
            <button
              type="button"
              onClick={() => rootDir && setNewFileIn(rootDir)}
              className="rounded border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-mute hover:text-text"
            >
              + 새 메모 만들기
            </button>
          </div>
        ) : (
          tree.map((node) => <TreeRow key={node.path} node={node} depth={0} ctx={ctx} />)
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
          title={`"${deleteTarget.node.name}" 삭제`}
          message={
            deleteTarget.node.type === 'folder'
              ? '폴더 안의 모든 파일이 휴지통으로 이동해요.'
              : deleteTarget.loading
                ? '이 메모를 가리키는 링크를 확인하고 있어요…'
                : deleteTarget.backlinks && deleteTarget.backlinks.length > 0
                  ? `이 메모를 가리키는 위키링크가 ${deleteTarget.backlinks.reduce((sum, b) => sum + b.count, 0)}개 있어요. 삭제하면 링크가 끊겨요.`
                  : '휴지통으로 이동해요.'
          }
          items={deleteTarget.backlinks?.map((b) => b.path.split('/').pop() ?? b.path)}
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
          onClose={() => setExportTarget(null)}
        />
      )}
    </div>
  )
})
