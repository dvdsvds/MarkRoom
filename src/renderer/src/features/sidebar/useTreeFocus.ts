import { useEffect, useMemo, useRef, useState } from 'react'
import type { TreeNode } from '../../types/workspace'
import { findNodeByPath } from './TreeRow'

export function useTreeFocus({
  tree,
  rootDir,
  activeFilePath,
  selectedFolderPath,
  onOpenFile,
  onSelectFolder,
  onFocusEditor
}: {
  tree: TreeNode[]
  rootDir: string | null
  activeFilePath: string | null
  selectedFolderPath: string | null
  onOpenFile: (filePath: string) => void
  onSelectFolder: (path: string | null) => void
  onFocusEditor: () => void
}) {
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

  const handleTreeKeyDown = (e: React.KeyboardEvent, onDelete: (node: TreeNode) => void): void => {
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
      onDelete(node)
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

  return {
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
  }
}