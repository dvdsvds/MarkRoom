import { fileNameOf } from '../utils/path'
import { useToastStore } from '../stores/toastStore'

/** docx·xlsx 미리보기 공통 틀. 위쪽에 읽기 전용 표시와 외부 앱 버튼을 둔다. */
export function OfficeViewerFrame({
  filePath,
  error,
  loading,
  children,
  footer
}: {
  filePath: string
  error: string | null
  loading: boolean
  children: React.ReactNode
  footer?: React.ReactNode
}): React.JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const openExternally = (): void => {
    void window.api.workspace.openInDefaultApp(filePath).then((err) => {
      if (err) pushToast({ kind: 'info', message: '이 파일을 열 수 있는 앱이 없어요.' })
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 text-[12px] text-text-tertiary">
        <span className="truncate">{fileNameOf(filePath)}</span>
        <span className="shrink-0 rounded bg-bg-mute px-1.5 py-0.5 text-[11px]">읽기 전용</span>
        <button
          type="button"
          onClick={openExternally}
          className="ml-auto shrink-0 rounded-md px-2 py-1 text-text-secondary transition-colors hover:bg-bg-mute hover:text-text"
        >
          외부 앱으로 열기
        </button>
      </div>
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[13px] text-text-tertiary">
          <p>미리보기를 만들 수 없어요.</p>
          <p className="text-[12px]">{error}</p>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-[13px] text-text-tertiary">
              불러오는 중…
            </div>
          )}
          {children}
        </div>
      )}
      {footer}
    </div>
  )
}
