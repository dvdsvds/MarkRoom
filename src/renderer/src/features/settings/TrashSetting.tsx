import { useState } from 'react'
import { useToastStore } from '../../stores/toastStore'

const BTN =
  'h-8 rounded-lg bg-bg-mute px-3 text-[13px] text-text-secondary outline-none transition-colors hover:text-text'

export function TrashSetting(): React.JSX.Element {
  const pushToast = useToastStore((s) => s.push)
  const [confirming, setConfirming] = useState(false)

  const empty = (): void => {
    void window.api.workspace.emptyTrash().then(() => {
      setConfirming(false)
      pushToast({ kind: 'info', message: '휴지통을 비웠어요.' })
    })
  }

  return (
    <div className="px-3.5 py-3">
      <div className="text-[13.5px] text-text">삭제한 파일은 30일 동안 보관돼요</div>
      <div className="mt-1 text-[12.5px] text-text-tertiary">
        사이드바에서 Ctrl+Z로 되돌릴 수 있어요
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button type="button" onClick={() => void window.api.workspace.openTrash()} className={BTN}>
          휴지통 폴더 열기
        </button>
        {confirming ? (
          <>
            <button type="button" onClick={empty} className={`${BTN} !text-danger`}>
              정말 비우기
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={BTN}>
              취소
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={BTN}>
            휴지통 비우기
          </button>
        )}
      </div>
    </div>
  )
}
