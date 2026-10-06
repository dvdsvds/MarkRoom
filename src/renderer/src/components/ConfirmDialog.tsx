import { useEffect } from "react"

interface ConfirmDialogProps {
  title: string
  message: string
  items?: string[]
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 삭제처럼 되돌리기 어려운 작업 전에 확인받는 가운데 모달. */
export function ConfirmDialog({
  title,
  message,
  items,
  confirmLabel,
  danger,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onConfirm])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-80 rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{message}</p>
        {items && items.length > 0 && (
          <ul className="mt-2 max-h-32 overflow-auto rounded-md bg-bg-mute p-2.5 text-xs text-text-secondary">
            {items.map((item) => (
              <li key={item} className="truncate">
                {item}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-mute focus:outline-none"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-text-inverted focus:outline-none ${
              danger ? 'bg-danger' : 'bg-accent'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
