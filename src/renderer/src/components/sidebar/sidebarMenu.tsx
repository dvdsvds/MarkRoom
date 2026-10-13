import type { TreeNode } from '../../types/workspace'
import type { ContextMenuItem } from '../ContextMenu'
import PlusIcon from '../../icons/ctx-plus.svg?react'
import RenameIcon from '../../icons/ctx-rename.svg?react'
import CopyPathIcon from '../../icons/tb-copy.svg?react'
import RevealIcon from '../../icons/ctx-reveal.svg?react'
import ExportFolderIcon from '../../icons/ctx-export.svg?react'
import DiffIcon from '../../icons/ctx-diff.svg?react'
import HistoryIcon from '../../icons/ctx-history.svg?react'
import TrashIcon from '../../icons/ctx-trash.svg?react'

export interface MenuActions {
  rootDir: string | null
  dirtyFilePaths: string[]
  expandPath: (path: string) => void
  startNewFile: (dirPath: string) => void
  startNewFolder: (dirPath: string) => void
  startRename: (path: string) => void
  openExport: (target: { folderPath: string; isRoot: boolean; label: string }) => void
  openDelete: (node: TreeNode) => void
  onCompareChanges: (filePath: string) => void
  onOpenHistory: (filePath: string) => void
}

export function buildMenuItems(node: TreeNode, a: MenuActions): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  if (node.type === 'folder') {
    items.push({
      label: '파일',
      icon: <PlusIcon width={16} height={16} />,
      onClick: () => {
        a.expandPath(node.path)
        a.startNewFile(node.path)
      }
    })
    items.push({
      label: '폴더',
      icon: <PlusIcon width={16} height={16} />,
      onClick: () => {
        a.expandPath(node.path)
        a.startNewFolder(node.path)
      }
    })
  }
  items.push({
    label: '이름 바꾸기',
    icon: <RenameIcon width={16} height={16} />,
    sepBefore: node.type === 'folder',
    onClick: () => a.startRename(node.path)
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
        a.openExport({
          folderPath: node.path,
          isRoot: a.rootDir !== null && node.path === a.rootDir,
          label: node.name
        })
    })
  }
  const isMd = node.type === 'file' && node.name.toLowerCase().endsWith('.md')
  if (isMd && a.dirtyFilePaths.includes(node.path)) {
    items.push({
      label: '변경 내용 비교',
      icon: <DiffIcon width={16} height={16} />,
      onClick: () => a.onCompareChanges(node.path)
    })
  }
  if (isMd) {
    items.push({
      label: '버전 기록',
      icon: <HistoryIcon width={16} height={16} />,
      onClick: () => a.onOpenHistory(node.path)
    })
  }
  items.push({
    label: '삭제',
    danger: true,
    icon: <TrashIcon width={16} height={16} />,
    sepBefore: true,
    onClick: () => a.openDelete(node)
  })
  return items
}