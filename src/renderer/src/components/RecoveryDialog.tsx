import { useEffect, useState } from 'react'
import { DiffContent } from './DiffContent'
import { useSettingsStore } from '../stores/settingsStore'
import { matchesShortcut } from '../utils/shortcuts'

interface RecoverableItem {
  tmpPath: string
  targetPath: string
  tmpContent: string
  currentContent: string | null
}

interface RecoveryDialogProps {
  items: RecoverableItem[]
  onDone: () => void
}

export function RecoveryDialog({
  items: initialItems,
  onDone
}: RecoveryDialogProps): React.JSX.Element {
  const [items, setItems] = useState(initialItems)
  const [checked, setChecked] = useState<Set<string>>(new Set(initialItems.map((i) => i.tmpPath)))
  const [selected, setSelected] = useState(initialItems[0]?.tmpPath ?? null)
  const shortcuts = useSettingsStore((s) => s.shortcuts)

  const selectedItem = items.find((i) => i.tmpPath === selected) ?? null

  const removeItem = (tmpPath: string): void => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.tmpPath === tmpPath)
      const next = prev.filter((i) => i.tmpPath !== tmpPath)
      if (next.length === 0) {
        onDone()
      } else if (selected === tmpPath) {
        setSelected(next[idx]?.tmpPath ?? next[Math.max(0, idx - 1)]?.tmpPath ?? next[0].tmpPath)
      }
      return next
    })
  }

  const applyOne = (item: RecoverableItem): void => {
    void window.api.workspace.applyRecovery(item.tmpPath, item.targetPath).then(() => {
      removeItem(item.tmpPath)
    })
  }

  const discardOne = (item: RecoverableItem): void => {
    void window.api.workspace.discardRecovery(item.tmpPath).then(() => {
      removeItem(item.tmpPath)
    })
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (!selectedItem) return
      if (matchesShortcut(e, shortcuts.diffApply)) {
        e.preventDefault()
        applyOne(selectedItem)
      } else if (matchesShortcut(e, shortcuts.diffRestore)) {
        e.preventDefault()
        discardOne(selectedItem)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedItem, shortcuts])

  const handleRecoverChecked = (): void => {
    void Promise.all(
      items.map((item) =>
        checked.has(item.tmpPath)
          ? window.api.workspace.applyRecovery(item.tmpPath, item.targetPath)
          : window.api.workspace.discardRecovery(item.tmpPath)
      )
    ).then(onDone)
  }

  const handleDiscardAll = (): void => {
    void Promise.all(items.map((item) => window.api.workspace.discardRecovery(item.tmpPath))).then(
      onDone
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[80vh] w-[860px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl">
        <div className="shrink-0 border-b border-border px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-text">복구할 메모가 있어요</h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">
            지난번에 앱이 비정상 종료돼서 저장이 끝까지 안 된 메모예요. 오른쪽 미리보기에서{' '}
            {shortcuts.diffApply}(적용하기) / {shortcuts.diffRestore}(복구하기)로 하나씩, 또는
            체크박스로 골라 한꺼번에 처리할 수 있어요.
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
          <div className="overflow-auto border-r border-border">
            {items.map((item) => {
              const name = item.targetPath.split('/').pop() ?? item.targetPath
              return (
                <div
                  key={item.tmpPath}
                  onClick={() => setSelected(item.tmpPath)}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[13px] ${
                    selected === item.tmpPath
                      ? 'bg-accent-soft text-accent'
                      : 'text-text hover:bg-bg-mute'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="ui-checkbox"
                    checked={checked.has(item.tmpPath)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() =>
                      setChecked((prev) => {
                        const next = new Set(prev)
                        if (next.has(item.tmpPath)) next.delete(item.tmpPath)
                        else next.add(item.tmpPath)
                        return next
                      })
                    }
                  />
                  <span className="truncate">{name}</span>
                </div>
              )
            })}
          </div>

          <div className="min-h-0">
            {selectedItem && (
              <DiffContent
                key={selectedItem.tmpPath}
                oldContent={selectedItem.currentContent ?? ''}
                newContent={selectedItem.tmpContent}
                oldLabel={selectedItem.currentContent === null ? '(파일 없음)' : '지금 저장된 내용'}
                newLabel="복구할 내용"
              />
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={handleDiscardAll}
            className="rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-mute focus:outline-none"
          >
            복구 안 함
          </button>
          <button
            type="button"
            onClick={handleRecoverChecked}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none"
          >
            선택한 항목 복구
          </button>
        </div>
      </div>
    </div>
  )
}
