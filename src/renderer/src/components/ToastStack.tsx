import { useEffect, useRef } from 'react'
import { useToastStore, type ToastItem } from '../stores/toastStore'

const AUTO_DISMISS_MS = 4500

interface ToastStackProps {
  onOpenDiff: (filePath: string, oldContent: string, newContent: string) => void
}

function ToastCard({
  toast,
  onRemove,
  onExpand,
  onOpenDiff
}: {
  toast: ToastItem
  onRemove: () => void
  onExpand: () => void
  onOpenDiff: (filePath: string, oldContent: string, newContent: string) => void
}): React.JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = (): void => {
    timerRef.current = setTimeout(onRemove, AUTO_DISMISS_MS)
  }
  const stop = (): void => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => {
    start()
    return stop
  }, [])

  const handleClick = (): void => {
    if (toast.kind === 'external-change-batch') {
      onExpand()
      return
    }
    if (toast.kind === 'info') {
      onRemove()
      return
    }
    onOpenDiff(toast.filePath, toast.oldContent, toast.newContent)
    onRemove()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={stop}
      onMouseLeave={start}
            className="w-auto max-w-md min-w-[16rem] break-words rounded-xl border border-border bg-bg-elevated px-4 py-3 text-left text-[13px] text-text shadow-2xl hover:border-border-strong"
    >
      {toast.message}
    </button>
  )
}

export function ToastStack({ onOpenDiff }: ToastStackProps): React.JSX.Element | null {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)
  const expandBatch = useToastStore((s) => s.expandBatch)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onRemove={() => remove(toast.id)}
          onExpand={() => expandBatch(toast.id)}
          onOpenDiff={onOpenDiff}
        />
      ))}
    </div>
  )
}
