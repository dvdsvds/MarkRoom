import { useEffect, useState } from 'react'

interface BrokenLink {
  fromPath: string
  title: string
  reason: 'missing' | 'outside'
}

interface ExportDialogProps {
  folderPath: string
  isRoot: boolean
  folderLabel: string
  onClose: () => void
}

type Phase = 'loading' | 'name' | 'links' | 'picking' | 'done'

const REPRESENTATIVE_OPTIONS: { value: 'README' | 'index' | 'main'; label: string }[] = [
  { value: 'README', label: 'README.md (기본)' },
  { value: 'index', label: 'index.md' },
  { value: 'main', label: 'main.md (이름 유지)' }
]

export function ExportDialog({
  folderPath,
  isRoot,
  folderLabel,
  onClose
}: ExportDialogProps): React.JSX.Element | null {
  const [phase, setPhase] = useState<Phase>('loading')
  const [hasMain, setHasMain] = useState(false)
  const [brokenLinks, setBrokenLinks] = useState<BrokenLink[]>([])
  const [representativeName, setRepresentativeName] = useState<'README' | 'index' | 'main'>(
    'README'
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      isRoot ? window.api.workspace.hasRootMainNote() : Promise.resolve(false),
      window.api.workspace.checkExportLinks(folderPath)
    ]).then(([main, links]) => {
      if (cancelled) return
      setHasMain(main)
      setBrokenLinks(links)
      setPhase(isRoot && main ? 'name' : links.length > 0 ? 'links' : 'picking')
    })
    return () => {
      cancelled = true
    }
  }, [folderPath, isRoot])

  useEffect(() => {
    if (phase !== 'picking') return
    let cancelled = false
    void (async () => {
      const destDir = await window.api.workspace.pickExportDestination()
      if (cancelled) return
      if (!destDir) {
        onClose()
        return
      }
      try {
        await window.api.workspace.exportFolder({
          folderPath,
          destDir,
          isRoot,
          representativeName: isRoot && hasMain ? representativeName : null
        })
        onClose()
      } catch {
        if (!cancelled) setError('내보내기에 실패했어요.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [phase])

  if (phase === 'loading' || phase === 'picking') return null

  if (error) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-80 rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl"
        >
          <p className="text-[13px] text-text">{error}</p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-mute focus:outline-none"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'name') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-80 rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl"
        >
          <h2 className="text-sm font-semibold text-text">대표 문서 이름</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
            루트의 main.md를 내보낼 때 쓸 이름을 골라주세요.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {REPRESENTATIVE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-text hover:bg-bg-mute"
              >
                <input
                  type="radio"
                  name="representative-name"
                  checked={representativeName === opt.value}
                  onChange={() => setRepresentativeName(opt.value)}
                  className="accent-[var(--color-accent)]"
                />
                {opt.label}
              </label>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-mute focus:outline-none"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => setPhase(brokenLinks.length > 0 ? 'links' : 'picking')}
              className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none"
            >
              계속
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-80 rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl"
      >
        <h2 className="text-sm font-semibold text-text">깨진 링크가 있어요</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          {`"${folderLabel}" 안 메모에 대상이 없거나 폴더 밖을 가리키는 위키링크가 ${brokenLinks.length}개 있어요.`}
        </p>
        <ul className="mt-2 max-h-32 overflow-auto rounded-md bg-bg-mute p-2.5 text-xs text-text-secondary">
          {brokenLinks.map((link, i) => (
            <li key={i} className="truncate">
              {`[[${link.title}]] (${link.fromPath.split('/').pop()}${
                link.reason === 'outside' ? ' — 폴더 밖' : ' — 없음'
              })`}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-mute focus:outline-none"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => setPhase('picking')}
            className="rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none"
          >
            그래도 내보내기
          </button>
        </div>
      </div>
    </div>
  )
}
