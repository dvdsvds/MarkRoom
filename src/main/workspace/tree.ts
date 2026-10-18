import { readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children?: TreeNode[]
}

function sortEntries(nodes: TreeNode[]): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name, 'ko')
  })
}

export function buildTree(dirPath: string): TreeNode[] {
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
    } else if (stat.isFile()) {
      nodes.push({ name: entry, path: fullPath, type: 'file' })
    }
  }

  return sortEntries(nodes)
}
