import { useEffect, useMemo, useRef, useState } from 'react'
import type { TreeNode } from '../types/workspace'

interface SearchResult {
  path: string
  title: string
  snippet: string | null
}

interface SearchPanelProps {
  rootDir: string | null
  tree: TreeNode[]
  onOpenFile: (filePath: string) => void
  onClose: () => void
}

function collectFolders(
  nodes: TreeNode[],
  out: { path: string; label: string }[],
  depth = 0
): void {
  for (const node of nodes) {
    if (node.type === 'folder') {
      out.push({ path: node.path, label: `${'  '.repeat(depth)}${node.name}` })
      if (node.children) collectFolders(node.children, out, depth + 1)
    }
  }
}

export function SearchPanel({
  rootDir,
  tree,
  onOpenFile,
  onClose
}: SearchPanelProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [folder, setFolder] = useState<string>('')
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const folders = useMemo(() => {
    const out: { path: string; label: string }[] = []
    collectFolders(tree, out)
    return out
  }, [tree])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    void window.api.workspace
      .search({
        text,
        folder: folder || null
      })
      .then(setResults)
  }, [text, folder])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[70vh] w-[520px] flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'Enter' && results[0]) {
                onOpenFile(results[0].path)
                onClose()
              }
            }}
            placeholder="메모 이름이나 내용을 검색해요…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-tertiary"
          />
          {rootDir && (
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="shrink-0 rounded-md border border-border bg-bg px-3 py-1.5 text-[13px] text-text-secondary outline-none focus:border-accent"
            >
              <option value="">전체 폴더</option>
              {folders.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-auto p-1">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-tertiary">결과가 없어요</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.path}
                type="button"
                onClick={() => {
                  onOpenFile(r.path)
                  onClose()
                }}
                className={`block w-full rounded-md px-3 py-2 text-left hover:bg-bg-mute ${i === 0 ? 'bg-bg-mute' : ''}`}
              >
                <div className="text-sm text-text">{r.title}</div>
                {r.snippet && (
                  <div className="mt-0.5 truncate text-xs text-text-tertiary">{r.snippet}</div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
