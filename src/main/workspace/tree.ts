import { readdirSync, statSync } from 'fs'
import { basename, extname, join } from 'path'

export interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children?: TreeNode[]
}

const VISIBLE_DOC_EXTENSIONS = new Set([
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  '.txt',
  '.csv'
])

function isVisibleFile(fileName: string, parentFolderName: string): boolean {
  if (parentFolderName === 'img' || parentFolderName === 'files') return true
  return VISIBLE_DOC_EXTENSIONS.has(extname(fileName).toLowerCase())
}

function sortEntries(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, 'ko')
  })
}

export function buildTree(dirPath: string): TreeNode[] {
  const parentFolderName = basename(dirPath)
  let entries: string[]
  try {
    entries = readdirSync(dirPath)
  } catch {
    return []
  }

  const nodes: TreeNode[] = []

  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const fullPath = join(dirPath, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      nodes.push({
        name: entry,
        path: fullPath,
        type: 'folder',
        children: buildTree(fullPath)
      })
    } else if (stat.isFile() && isVisibleFile(entry, parentFolderName)) {
      nodes.push({ name: entry, path: fullPath, type: 'file' })
    }
  }

  return sortEntries(nodes)
}
