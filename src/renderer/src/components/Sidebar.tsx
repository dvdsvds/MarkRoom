import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { TreeNode } from '../types/workspace'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { ConfirmDialog } from './ConfirmDialog'
import { ExportDialog } from './ExportDialog'
import { FileExt, FileTypeIcon } from './FileTypeIcon'
import { dirOf, fileNameOf, sepOf } from '@renderer/utils/path'
import PlusIcon from '../icons/ctx-plus.svg?react'
import RenameIcon from '../icons/ctx-rename.svg?react'
import CopyPathIcon from '../icons/tb-copy.svg?react'
import RevealIcon from '../icons/ctx-reveal.svg?react'
import ExportFolderIcon from '../icons/ctx-export.svg?react'
import DiffIcon from '../icons/ctx-diff.svg?react'
import HistoryIcon from '../icons/ctx-history.svg?react'
import TrashIcon from '../icons/ctx-trash.svg?react'
import ChevronIcon from '../icons/chevron.svg?react'
import ExportIcon from '../icons/export.svg?react'
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
  /** 파일을 열고 해당 줄로 이동 (내보내기 깨진 링크용) */
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

interface RowContext {
  activeFilePath: string | null
  selectedFolderPath: string | null
  highlightOff: boolean
  showRing: boolean
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

const ICON_BTN =
  'flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary'

const ROW_BASE =
  'flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left text-[13px] text-text transition-colors hover:bg-bg-mute/60 focus:outline-none'

const SYSTEM_FOLDERS = new Set(['img', 'files'])

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

/** 파일 이름을 이름 부분과 확장자(점 포함)로 나눈다. 점이 맨 앞이거나 없으면 확장자 없음. */
function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot) }
}

function nameWithoutExt(node: TreeNode): string {
  return node.type === 'file' ? splitName(node.name).base : node.name
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
          ? '-ml-px relative min-w-0 flex-1 rounded border border-accent bg-bg px-1 py-0 leading-none text-[13px] text-text outline-none'
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
  const paddingLeft = 8 + depth * 12
  const childPadding = 8 + (depth + 1) * 12

  if (node.type === 'folder') {
    const isSystem = SYSTEM_FOLDERS.has(node.name)
    const isSelected = ctx.selectedFolderPath === node.path
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
            <div className="flex h-7 w-full items-center gap-2 pr-2" style={{ paddingLeft }}>
              <ChevronIcon
                width={12}
                height={12}
                style={{
                  width: 12,
                  height: 12,
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
                className="shrink-0 text-text-secondary transition-transform"
              />
              <FileTypeIcon name={node.name} kind="folder" />
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
              className={`${ROW_BASE} ${
                ctx.showRing && ctx.focusedPath === node.path
                  ? 'ring-1 ring-inset ring-accent/60'
                  : ''
              } ${isSelected ? 'bg-bg-mute' : ''} text-text`}
              style={{ paddingLeft }}
            >
              <ChevronIcon
                width={12}
                height={12}
                className="shrink-0 text-text-secondary transition-transform"
                style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              />
              <FileTypeIcon name={node.name} kind="folder" />
              <span className={`truncate ${isSystem ? 'font-normal' : 'font-medium'}`}>
                {node.name}
              </span>
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="children"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              {ctx.newFolderIn === node.path && (
                <div
                  className="flex h-7 w-full items-center gap-2 pr-2"
                  style={{ paddingLeft: childPadding }}
                >
                  <ChevronIcon
                    width={12}
                    height={12}
                    style={{ width: 12, height: 12 }}
                    className="shrink-0 opacity-0"
                  />
                  <FileTypeIcon name="" kind="folder" />
                  <InlineNameInput
                    initialValue=""
                    onCommit={(value) => ctx.onCommitNewFolder(node.path, value)}
                    onCancel={ctx.onCancelNewFolder}
                    paddingLeft={0}
                    inline
                  />
                </div>
              )}
              {ctx.newFileIn === node.path && (
                <div
                  className="flex h-7 w-full items-center gap-2 pr-2"
                  style={{ paddingLeft: childPadding + 20 }}
                >
                  <FileTypeIcon name="new.md" kind="file" />
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (ctx.editingPath === node.path) {
    return (
      <div
        className="flex h-7 w-full items-center gap-2 pr-2"
        style={{ paddingLeft: paddingLeft + 20 }}
      >
        <FileTypeIcon name={node.name} kind="file" />
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

  const isActive = node.path === ctx.activeFilePath && !ctx.selectedFolderPath && !ctx.highlightOff
  const isDirty = ctx.dirtyFilePaths.includes(node.path)
  const { base, ext } = splitName(node.name)
  return (
    <button
      ref={(el) => ctx.registerRowRef(node.path, el)}
      type="button"
      draggable
      onDragStart={(e) => ctx.onDragStart(e, node)}
      onDragEnd={ctx.onDragEnd}
      onContextMenu={(e) => ctx.onContextMenu(e, node)}
      onClick={() => ctx.onOpenFile(node.path)}
      className={`${ROW_BASE} ${
        ctx.showRing && ctx.focusedPath === node.path ? 'ring-1 ring-inset ring-accent/60' : ''
      } ${isActive ? 'bg-bg-mute' : ''} ${ctx.draggingPath === node.path ? 'opacity-40' : ''}`}
      style={{ paddingLeft: paddingLeft + 20 }}
    >
      <FileTypeIcon name={node.name} kind="file" />
      <span className="truncate">
        {base}
        {ext && <FileExt name={node.name} ext={ext} />}
      </span>
      {isDirty && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
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

  const menuItems: ContextMenuItem[] = contextMenu
    ? (() => {
        const node = contextMenu.node
        const items: ContextMenuItem[] = []
        if (node.type === 'folder') {
          items.push({
            label: '파일',
            icon: <PlusIcon width={16} height={16} />,
            onClick: () => {
              expandPath(node.path)
              setNewFileIn(node.path)
            }
          })
          items.push({
            label: '폴더',
            icon: <PlusIcon width={16} height={16} />,
            onClick: () => {
              expandPath(node.path)
              setNewFolderIn(node.path)
            }
          })
        }
        items.push({
          label: '이름 바꾸기',
          icon: <RenameIcon width={16} height={16} />,
          sepBefore: node.type === 'folder',
          onClick: () => setEditingPath(node.path)
        })
        items.push({
          label: '경로 복사',
          icon: <CopyPathIcon width={16} height={16} />,
          onClick: () => void window.api.workspace.copyPath(node.path, false)
        })
        items.push({
          label: '폴더에서 보기',
          icon: <RevealIcon width={16} height={16} />,
          sepBefore: true,
          onClick: () => void window.api.workspace.reveal(node.path)
        })
        if (node.type === 'folder') {
          items.push({
            label: '폴더 내보내기',
            icon: <ExportFolderIcon width={16} height={16} />,
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
            icon: <DiffIcon width={16} height={16} />,
            onClick: () => onCompareChanges(node.path)
          })
        }
        if (node.type === 'file' && node.name.toLowerCase().endsWith('.md')) {
          items.push({
            label: '버전 기록',
            icon: <HistoryIcon width={16} height={16} />,
            onClick: () => onOpenHistory(node.path)
          })
        }
        items.push({
          label: '삭제',
          danger: true,
          icon: <TrashIcon width={16} height={16} />,
          sepBefore: true,
          onClick: () => openDeleteConfirm(node)
        })
        return items
      })()
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
          <div className="flex h-7 w-full items-center gap-2 pr-2" style={{ paddingLeft: 8 + 20 }}>
            <FileTypeIcon name="new.md" kind="file" />
            <InlineNameInput
              initialValue=""
              onCommit={(value) => commitNewFile(rootDir, value)}
              onCancel={() => setNewFileIn(null)}
              paddingLeft={0}
              inline
            />
          </div>
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
