import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { FileTypeIcon } from './FileTypeIcon'

interface SearchResult {
  path: string
  title: string
  snippet: string | null
}

interface SearchPanelProps {
  rootDir: string | null
  onOpenFile: (filePath: string) => void
  onClose: () => void
}

const MAX_LIST_HEIGHT = 360
const MAX_RESULTS = 10

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

/** 루트 기준으로 파일이 들어 있는 폴더 경로만 돌려준다. 루트 바로 아래면 빈 문자열. */
function folderLabel(path: string, rootDir: string | null): string {
  let rel = path.replace(/\\/g, '/')
  const root = rootDir ? rootDir.replace(/\\/g, '/') : ''
  if (root && rel.startsWith(`${root}/`)) rel = rel.slice(root.length + 1)
  const idx = rel.lastIndexOf('/')
  return idx >= 0 ? rel.slice(0, idx) : ''
}

function Highlight({ text, query }: { text: string; query: string }): React.JSX.Element {
  const q = query.trim()
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded bg-bg-mute px-1 text-[11px] text-text-secondary">
      {children}
    </span>
  )
}

export function SearchPanel({ rootDir, onOpenFile, onClose }: SearchPanelProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [active, setActive] = useState(0)
  const [listHeight, setListHeight] = useState<number | null>(null)
  // 열리는 동안(창 애니메이션 중)에는 목록 높이를 애니메이션하지 않는다. 겹치면 프레임이 떨어진다.
  const [settled, setSettled] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    inputRef.current?.focus()
    const t = window.setTimeout(() => setSettled(true), 250)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.api.workspace.search({ text, folder: null }).then((r) => {
      if (cancelled) return
      setResults(r.slice(0, MAX_RESULTS))
      setActive(0)
    })
    return () => {
      cancelled = true
    }
  }, [text])

  // 결과 수가 바뀌면 목록 높이가 뚝 바뀌지 않고 부드럽게 늘고 줄도록 안쪽 높이를 잰다.
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setListHeight(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    rowRefs.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const open = (r: SearchResult): void => {
    onOpenFile(r.path)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (results.length > 0) setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (results.length > 0) setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      const r = results[active]
      if (r) open(r)
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[14vh]"
      style={{ willChange: 'opacity' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        style={{ willChange: 'transform, opacity' }}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
        className="flex w-[560px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        <div className="flex h-[52px] items-center gap-2.5 border-b border-border px-4">
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="shrink-0 text-text-tertiary"
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="4.9" />
            <path d="M11.6 11.6L15.5 15.5" />
          </svg>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메모 이름이나 내용을 검색해요…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-text-tertiary"
          />
        </div>

        <motion.div
          initial={false}
          animate={{
            height: listHeight === null ? 'auto' : Math.min(listHeight, MAX_LIST_HEIGHT)
          }}
          transition={{ duration: settled ? 0.15 : 0, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-y-auto"
        >
          <div ref={innerRef} className="p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-text-tertiary">결과가 없어요</p>
            ) : (
              results.map((r, i) => {
                const folder = folderLabel(r.path, rootDir)
                return (
                  <button
                    key={r.path}
                    ref={(el) => {
                      rowRefs.current[i] = el
                    }}
                    type="button"
                    onClick={() => open(r)}
                    onMouseMove={() => active !== i && setActive(i)}
                    className="relative flex h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left"
                  >
                    {i === active && (
                      <motion.div
                        layoutId="search-active-pill"
                        className="absolute inset-0 rounded-lg bg-bg-mute"
                        transition={{ type: 'spring', stiffness: 600, damping: 45 }}
                      />
                    )}
                    <span className="relative flex">
                      <FileTypeIcon name={baseName(r.path)} kind="file" />
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-text">
                        <Highlight text={r.title} query={text} />
                      </span>
                      {r.snippet && (
                        <span className="mt-px block truncate text-[11.5px] text-text-tertiary">
                          <Highlight text={r.snippet} query={text} />
                        </span>
                      )}
                    </span>
                    {folder && (
                      <span className="relative max-w-[160px] shrink-0 truncate text-[11.5px] text-text-tertiary">
                        {folder}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </motion.div>

        <div className="flex h-[34px] items-center gap-4 border-t border-border px-4 text-[11.5px] text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            이동
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>↵</Kbd>
            열기
          </span>
          <span className="flex items-center gap-1.5">
            <Kbd>esc</Kbd>
            닫기
          </span>
        </div>
      </motion.div>
    </motion.div>
  )
}