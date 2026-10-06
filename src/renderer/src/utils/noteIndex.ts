import type { TreeNode } from '../types/workspace'

export interface NoteRef {
  title: string
  path: string
}

export function flattenNotes(tree: TreeNode[]): NoteRef[] {
  const notes: NoteRef[] = []
  for (const node of tree) {
    if (node.type === 'folder') {
      if (node.children) notes.push(...flattenNotes(node.children))
    } else if (node.name.toLowerCase().endsWith('.md')) {
      notes.push({ title: node.name.replace(/\.md$/i, ''), path: node.path })
    }
  }
  return notes
}
