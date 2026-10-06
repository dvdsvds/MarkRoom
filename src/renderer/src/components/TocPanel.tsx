import { useEffect, useRef } from 'react'
import type { TocEntry } from '../utils/toc'

interface TocPanelProps {
  entries: TocEntry[]
  onJump: (line: number) => void
  onClose: () => void
  /** 0에서 시작. App에서 단축키를 다시 누를 때마다 늘려서 패널로 포커스를 옮긴다. */
  focusToken: number
  /** 패널에 포커스가 있을 때 Esc를 누르면 부른다 — 패널은 닫지 않고 에디터로만 돌아간다. */
  onReturnFocus: () => void
}

/**
 * 목차 플로팅 패널 (기획 문서 8장).
 *
 * "제목을 눌러도 열려 있음, 에디터에 포커스 유지" — 제목 클릭은 onJump로
 * MarkdownEditorHandle.scrollToLine을 호출하는데, 그 구현이 끝에 view.focus()를
 * 부르므로 자연히 에디터로 포커스가 돌아간다.
 * "키보드는 단축키로 패널에 포커스 이동, Esc로 복귀" — 패널이 이미 열려 있는
 * 상태에서 같은 단축키를 다시 누르면 App이 focusToken을 늘려서 이 패널
 * 안으로 포커스를 옮기고, 거기서 Esc를 누르면(패널은 안 닫고) onReturnFocus로
 * 에디터 포커스만 되돌린다.
 */
export function TocPanel({
  entries,
  onJump,
  onClose,
  focusToken,
  onReturnFocus
}: TocPanelProps): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (focusToken === 0) return
    if (firstButtonRef.current) firstButtonRef.current.focus()
    else panelRef.current?.focus()
  }, [focusToken])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onReturnFocus()
    }
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed right-4 top-14 z-30 max-h-[70vh] w-64 overflow-auto rounded-xl border border-border bg-bg-elevated p-2 shadow-2xl outline-none"
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-text-secondary">목차</span>
        <button
          type="button"
          onClick={onClose}
          title="닫기"
          className="rounded-md px-1 text-text-tertiary hover:bg-bg-mute hover:text-text"
        >
          ✕
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="px-1 py-2 text-xs text-text-tertiary">제목이 없어요</p>
      ) : (
        <ul>
          {entries.map((entry, i) => (
            <li key={`${entry.line}-${i}`}>
              <button
                ref={i === 0 ? firstButtonRef : undefined}
                type="button"
                onClick={() => onJump(entry.line)}
                style={{ paddingLeft: `${(entry.level - 1) * 12 + 4}px` }}
                title={entry.text}
                className="block w-full truncate rounded-md py-1.5 text-left text-[13px] text-text hover:bg-bg-mute"
              >
                {entry.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
