import { useEffect, useState } from 'react'
import { DiffContent } from './DiffContent'

interface HistoryEntry {
  id: number
  size: number
}

interface HistoryDialogProps {
  filePath: string
  currentContent: string
  onRestore: (content: string) => void
  onClose: () => void
}

function formatTime(id: number): string {
  const d = new Date(id)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 저장 버전 기록. 왼쪽에서 버전을 고르면 지금 내용과의 차이를 보여주고, 그 버전으로 되돌릴 수 있다. */
export function HistoryDialog({
  filePath,
  currentContent,
  onRestore,
  onClose
}: HistoryDialogProps): React.JSX.Element {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)

  useEffect(() => {
    void window.api.workspace.listHistory(filePath).then((list) => {
      setEntries(list)
      setSelectedId(list[0]?.id ?? null)
    })
  }, [filePath])

  useEffect(() => {
    if (selectedId === null) {
      setSnapshot(null)
      return
    }
    let cancelled = false
    void window.api.workspace.readHistory(filePath, selectedId).then((text) => {
      if (!cancelled) setSnapshot(text)
    })
    return () => {
      cancelled = true
    }
  }, [filePath, selectedId])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const name = filePath.split(/[\\/]/).pop() ?? filePath

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[80vh] w-[860px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <span className="text-[15px] font-semibold text-text">버전 기록</span>
            <span className="ml-2 truncate text-xs text-text-tertiary">{name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 text-text-secondary hover:bg-bg-mute hover:text-text focus:outline-none"
          >
            ✕
          </button>
        </div>

        {entries !== null && entries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-text-tertiary">
            아직 저장 기록이 없어요. 저장하면 덮어쓰기 전 내용이 기록돼요.
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[200px_1fr]">
            <div className="overflow-auto border-r border-border p-1.5">
              {entries?.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] focus:outline-none ${
                    selectedId === entry.id
                      ? 'bg-accent-soft text-accent'
                      : 'text-text hover:bg-bg-mute'
                  }`}
                >
                  {formatTime(entry.id)}
                </button>
              ))}
            </div>
            <div className="min-h-0">
              {snapshot !== null && selectedId !== null && (
                <DiffContent
                  key={selectedId}
                  oldContent={snapshot}
                  newContent={currentContent}
                  oldLabel={`이전 버전 · ${formatTime(selectedId)}`}
                  newLabel="지금 내용"
                />
              )}
            </div>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-mute focus:outline-none"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={snapshot === null}
            onClick={() => snapshot !== null && onRestore(snapshot)}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none disabled:opacity-40"
          >
            이 버전으로 복구
          </button>
        </div>
      </div>
    </div>
  )
}