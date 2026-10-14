import { AnimatePresence, motion } from 'motion/react'
import type { TreeNode } from '../../types/workspace'
import { FileExt, FileTypeIcon } from '../../components/FileTypeIcon'
import { splitName } from '@renderer/utils/path'
import ChevronIcon from '../../icons/chevron.svg?react'
import { InlineNameInput, NewFileRow } from './InlineInputs'

export interface RowContext {
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

const ROW_BASE =
  'flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left text-[13px] text-text transition-colors hover:bg-bg-mute/60 focus:outline-none'

const SYSTEM_FOLDERS = new Set(['img', 'files'])

export function findNodeByPath(nodes: TreeNode[], path: string): TreeNode | null {
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
  return node.type === 'file' ? splitName(node.name).base : node.name
}

export function TreeRow({
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
                medium={!isSystem}
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
                    medium
                  />
                </div>
              )}
              {ctx.newFileIn === node.path && (
                <NewFileRow
                  paddingLeft={childPadding + 20}
                  onCommit={(value) => ctx.onCommitNewFile(node.path, value)}
                  onCancel={ctx.onCancelNewFile}
                />
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