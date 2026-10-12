import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { FileTypeIcon } from './FileTypeIcon'

interface TodoItem {
  path: string
  line: number
  text: string
  done: boolean
}

interface TodoDialogProps {
  onOpen: (path: string, line: number) => void
  onToggle: (path: string, line: number) => Promise<void>
  getOverrides: () => Record<string, string>
  onClose: () => void
}

interface Group {
  path: string
  title: string
  items: TodoItem[]
}

const SEGMENT_WIDTH = 56

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

function fileTitle(path: string): string {
  return baseName(path).replace(/\.md$/i, '')
}

function parentName(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts.length >= 2 ? parts[parts.length - 2] : ''
}

export function TodoDialog({
  onOpen,
  onToggle,
  getOverrides,
  onClose
}: TodoDialogProps): React.JSX.Element {
  const [items, setItems] = useState<TodoItem[] | null>(null)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setItems(await window.api.workspace.scanTodos(getOverrides()))
  }, [getOverrides])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleToggle = async (it: TodoItem): Promise<void> => {
    await onToggle(it.path, it.line)
    await load()
  }

  const { groups, duplicateTitles, openCount, doneCount } = useMemo(() => {
    const list = items ?? []
    const open = list.filter((it) => !it.done).length
    const shown = showDone ? list : list.filter((it) => !it.done)
    const byPath = new Map<string, TodoItem[]>()
    for (const it of shown) {
      const arr = byPath.get(it.path)
      if (arr) arr.push(it)
      else byPath.set(it.path, [it])
    }
    const grouped: Group[] = Array.from(byPath, ([path, its]) => ({
      path,
      title: fileTitle(path),
      items: its
    }))
    // 폴더만 다르고 이름이 같은 파일이 있으면 폴더 이름을 같이 보여준다.
    const seen = new Map<string, number>()
    for (const g of grouped) seen.set(g.title, (seen.get(g.title) ?? 0) + 1)
    const dup = new Set(
      Array.from(seen)
        .filter(([, n]) => n > 1)
        .map(([t]) => t)
    )
    return { groups: grouped, duplicateTitles: dup, openCount: open, doneCount: list.length - open }
  }, [items, showDone])

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      style={{ willChange: 'opacity' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        style={{ willChange: 'transform, opacity' }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
        className="flex max-h-[70vh] w-[560px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        <div className="flex shrink-0 items-center justify-between pb-2.5 pl-[22px] pr-4 pt-4">
          <div>
            <h2 className="text-[17px] font-medium text-text">할 일</h2>
            <div className="mt-1.5 flex flex-col gap-0.5 text-[13px] text-text-secondary">
              <span className="flex items-baseline gap-1.5">
                미완료
                <b className="min-w-3.5 text-[15px] font-medium text-accent">{openCount}</b>
              </span>
              <span className="flex items-baseline gap-1.5">
                완료
                <b className="min-w-3.5 text-[15px] font-medium text-text">{doneCount}</b>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              className="relative inline-flex rounded-[9px] bg-text/[0.07] p-0.5"
            >
              <span
                aria-hidden="true"
                className="absolute left-0.5 top-0.5 h-6 rounded-[7px] bg-text/[0.13] transition-transform duration-150 ease-out"
                style={{
                  width: SEGMENT_WIDTH,
                  transform: `translateX(${showDone ? SEGMENT_WIDTH : 0}px)`
                }}
              />
              {[
                { value: false, label: '미완료' },
                { value: true, label: '전체' }
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  role="radio"
                  aria-checked={showDone === o.value}
                  onClick={() => setShowDone(o.value)}
                  className={`relative h-6 rounded-[7px] text-[12.5px] outline-none transition-colors ${
                    showDone === o.value ? 'text-text' : 'text-text-secondary hover:text-text'
                  }`}
                  style={{ width: SEGMENT_WIDTH }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              title="닫기 (Esc)"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-mute hover:text-text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--color-border-strong)_transparent]">
          {items === null ? (
            <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">불러오는 중…</p>
          ) : groups.length === 0 ? (
            openCount === 0 && doneCount === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-5 pb-10 pt-9 text-center">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 18 18"
                  style={{ color: 'var(--icon-md)' }}
                  aria-hidden="true"
                >
                  <rect
                    x="1"
                    y="1"
                    width="16"
                    height="16"
                    rx="4"
                    fill="currentColor"
                    fillOpacity={0.2}
                  />
                  <path
                    d="M5.6 9.3l2.3 2.3 4.5-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm text-text">할 일이 없어요</p>
                <p className="text-[12.5px] text-text-tertiary">
                  파일에{' '}
                  <code className="rounded bg-text/[0.07] px-1.5 py-px font-editor text-xs text-text-secondary">
                    - [ ] 할 일
                  </code>
                  을 작성하면 여기에 모여요
                </p>
              </div>
            ) : (
              <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">
                미완료 할 일이 없어요
              </p>
            )
          ) : (
            groups.map((g) => (
              <section key={g.path}>
                <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-3 text-xs text-text-secondary">
                  <FileTypeIcon name={baseName(g.path)} kind="file" size={16} />
                  <span>{g.title}</span>
                  {duplicateTitles.has(g.title) && parentName(g.path) && (
                    <span className="text-text-tertiary">{parentName(g.path)}</span>
                  )}
                  <span className="text-text-tertiary">{g.items.length}</span>
                </div>
                <ul>
                  {g.items.map((it) => (
                    <li
                      key={`${it.path}:${it.line}`}
                      className="flex min-h-9 items-start gap-2.5 rounded-lg px-2.5 py-[7px] transition-colors hover:bg-bg-mute"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={it.done}
                        onClick={() => void handleToggle(it)}
                        title={it.done ? '완료 취소' : '완료로 표시'}
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] outline-none transition-colors ${
                          it.done ? 'border-accent bg-accent' : 'border-text/30 hover:border-accent'
                        }`}
                      >
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 10 10"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className={`text-bg transition-opacity ${it.done ? 'opacity-100' : 'opacity-0'}`}
                        >
                          <path d="M2 5.3l2 2L8 3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpen(it.path, it.line)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left outline-none"
                      >
                        <span
                          className={`min-w-0 flex-1 break-words text-[13.5px] leading-5 ${
                            it.done ? 'text-text-tertiary line-through' : 'text-text'
                          }`}
                        >
                          {it.text}
                        </span>
                        <span className="shrink-0 text-[11.5px] leading-5 text-text-tertiary">
                          {it.line}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
