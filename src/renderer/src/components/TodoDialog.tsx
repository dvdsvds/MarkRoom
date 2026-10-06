import { useCallback, useEffect, useMemo, useState } from 'react'

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

function fileTitle(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? path
  return name.replace(/\.md$/i, '')
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

  const { visible, openCount, doneCount } = useMemo(() => {
    const list = items ?? []
    const open = list.filter((it) => !it.done).length
    return {
      visible: showDone ? list : list.filter((it) => !it.done),
      openCount: open,
      doneCount: list.length - open
    }
  }, [items, showDone])

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[70vh] w-[560px] flex-col rounded-xl border border-border bg-bg-elevated shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-text">할일</span>
            <span className="text-xs text-text-tertiary">
              남은 {openCount}개 · 완료 {doneCount}개
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={showDone}
                onChange={(e) => setShowDone(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              완료 포함
            </label>
            <button
              type="button"
              onClick={onClose}
              title="닫기 (Esc)"
              className="rounded-md px-1 text-text-tertiary hover:bg-bg-mute hover:text-text"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-2">
          {items === null ? (
            <p className="px-2 py-6 text-center text-xs text-text-tertiary">불러오는 중…</p>
          ) : visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-text-tertiary">
              {openCount === 0 && doneCount === 0
                ? '할일이 없어요. 메모에 "- [ ] 할 일"을 적어 보세요.'
                : '남은 할일이 없어요'}
            </p>
          ) : (
            <ul>
              {visible.map((it) => (
                <li
                  key={`${it.path}:${it.line}`}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-bg-mute"
                >
                  <button
                    type="button"
                    onClick={() => void handleToggle(it)}
                    title={it.done ? '완료 취소' : '완료로 표시'}
                    className={`mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none ${
                      it.done
                        ? 'border-accent bg-accent text-bg'
                        : 'border-border-strong text-transparent hover:border-accent'
                    }`}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpen(it.path, it.line)}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    <span
                      className={`min-w-0 flex-1 break-words text-[13px] ${
                        it.done ? 'text-text-tertiary line-through' : 'text-text'
                      }`}
                    >
                      {it.text}
                    </span>
                    <span className="shrink-0 text-xs text-text-tertiary">
                      {fileTitle(it.path)}:{it.line}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}