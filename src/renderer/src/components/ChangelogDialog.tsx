import { useEffect } from 'react'

interface ChangelogDialogProps {
  content: string
  onClose: () => void
}

/**
 * 업데이트 후 첫 실행 때 뜨는 변경 내용 팝업 (기획 문서 11장). 닫기
 * 버튼, Esc, 바깥 클릭 아무걸로나 닫힌다.
 */
export function ChangelogDialog({ content, onClose }: ChangelogDialogProps): React.JSX.Element {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-96 max-w-[90vw] rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-text">새로워진 점</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1.5 text-text-secondary hover:bg-bg-mute hover:text-text focus:outtline-none"
          >
            ✕
          </button>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
          {content}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
