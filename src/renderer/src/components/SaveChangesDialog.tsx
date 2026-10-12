interface SaveChangesDialogProps {
  title: string
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function SaveChangesDialog({
  title,
  onSave,
  onDiscard,
  onCancel
}: SaveChangesDialogProps): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-80 rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-text">변경 내용을 저장할까요?</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          &quot;{title}&quot; 파일을 닫기 전에 저장하지 않으면 변경 내용이 사라져요.
        </p>
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
            onClick={onDiscard}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-danger hover:bg-bg-mute focus:outline-none"
          >
            저장 안 함
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
