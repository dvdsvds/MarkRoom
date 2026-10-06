import { create } from 'zustand'
import type { TreeNode } from '../types/workspace'

interface WorkspaceState {
  rootDir: string | null
  tree: TreeNode[]
  setTree: (tree: TreeNode[]) => void
  setRootDir: (rootDir: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  rootDir: null,
  tree: [],
  setTree: (tree) => set({ tree }),
  setRootDir: (rootDir) => set({ rootDir })
}))
