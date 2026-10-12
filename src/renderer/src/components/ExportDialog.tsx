import { useEffect, useState } from 'react'
import { exportPdfBatch } from './exportPdfBatch'

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

type Phase = 'loading' | 'form' | 'name' | 'links' | 'working' | 'result'

const REPRESENTATIVE_OPTIONS: { value: 'README' | 'index' | 'main'; label: string }[] = [
  { value: 'README', label: 'README.md (기본)' },
  { value: 'index', label: 'index.md' },
  { value: 'main', label: 'main.md (이름 유지)' }
]

const BAD_CHARS = /[\\/:*?"<>|]/g
const BTN_GHOST =
  'rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-mute focus:outline-none'
const BTN_MAIN =
  'rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-text-inverted focus:outline-none disabled:opacity-40'

function Overlay({
  onClose,
  children
}: {
  onClose?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-80 rounded-xl border border-border bg-bg-elevated p-5 shadow-2xl"
      >
        {children}
      </div>
    </div>
  )
}

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
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [useMd, setUseMd] = useState(true)
  const [usePdf, setUsePdf] = useState(true)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failures, setFailures] = useState<string[]>([])
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
      setPhase('form')
    })
    return () => {
      cancelled = true
    }
  }, [folderPath, isRoot])

  const run = async (): Promise<void> => {
    const parent = await window.api.workspace.pickExportDestination()
    if (!parent) {
      setPhase('form')
      return
    }
    setPhase('working')
    setProgress(null)
    try {
      const prep = await window.api.workspace.prepareExport(parent, name.trim(), useMd, usePdf)
      if (!prep.ok) {
        if (prep.error === 'exists') {
          setNameError('이미 있어요. 다른 이름을 입력해 주세요.')
          setPhase('form')
        } else if (prep.error === 'denied') {
          setError(
            '폴더에 쓸 수 없어요. 문서, 사진, 바탕화면 같은 보호 폴더는 Windows 보안이 막을 수 있어요. 다른 폴더를 골라 주세요.'
          )
        } else {
          setError('이름을 확인해 주세요.')
        }
        return
      }
      const { baseDir, mdDir, pdfDir } = prep
      if (mdDir) {
        await window.api.workspace.exportFolder({
          folderPath,
          destDir: mdDir,
          isRoot,
          representativeName: isRoot && hasMain ? representativeName : null
        })
      }
      let failed: string[] = []
      if (pdfDir) {
        const notes = await window.api.workspace.listPdfNotes(folderPath)
        setProgress({ done: 0, total: notes.length })
        failed = await exportPdfBatch(notes, pdfDir, (done, total) =>
          setProgress({ done, total })
        )
      }
      void window.api.workspace.openPath(baseDir)
      if (failed.length > 0) {
        setFailures(failed)
        setPhase('result')
      } else {
        onClose()
      }
    } catch {
      setError('내보내기에 실패했어요. 보호 폴더(문서, 사진, 바탕화면)면 Windows 보안이 막을 수 있어요.')
    }
  }

  const afterNameStep = (): void => {
    if (brokenLinks.length > 0) setPhase('links')
    else void run()
  }

  const submitForm = async (): Promise<void> => {
    const clean = name.trim()
    if (!clean || (!useMd && !usePdf)) return
    if (useMd && isRoot && hasMain) setPhase('name')
    else afterNameStep()
  }

  if (phase === 'loading') return null

  if (error) {
    return (
      <Overlay onClose={onClose}>
        <p className="text-[13px] text-text">{error}</p>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            닫기
          </button>
        </div>
      </Overlay>
    )
  }

  if (phase === 'working') {
    return (
      <Overlay>
        <p className="text-[13px] text-text">
          {progress ? `PDF 만드는 중… ${progress.done} / ${progress.total}` : '내보내는 중…'}
        </p>
      </Overlay>
    )
  }

  if (phase === 'result') {
    return (
      <Overlay onClose={onClose}>
        <h2 className="text-sm font-semibold text-text">일부 PDF를 만들지 못했어요</h2>
        <ul className="mt-2 max-h-32 overflow-auto rounded-md bg-bg-mute p-2.5 text-xs text-text-secondary">
          {failures.map((f, i) => (
            <li key={i} className="truncate" title={f}>
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            닫기
          </button>
        </div>
      </Overlay>
    )
  }

  if (phase === 'name') {
    return (
      <Overlay onClose={onClose}>
        <h2 className="text-sm font-semibold text-text">대표 문서 이름</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          루트의 main.md를 MD로 내보낼 때 쓸 이름을 골라주세요.
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
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            취소
          </button>
          <button type="button" onClick={afterNameStep} className={BTN_MAIN}>
            계속
          </button>
        </div>
      </Overlay>
    )
  }

  if (phase === 'links') {
    return (
      <Overlay onClose={onClose}>
        <h2 className="text-sm font-semibold text-text">깨진 링크가 있어요</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
          {`"${folderLabel}" 안 메모에 대상이 없거나 폴더 밖을 가리키는 위키링크가 ${brokenLinks.length}개 있어요.`}
        </p>
        <ul className="mt-2 max-h-32 overflow-auto rounded-md bg-bg-mute p-2.5 text-xs text-text-secondary">
          {brokenLinks.map((link, i) => (
            <li key={i} className="truncate">
              {`[[${link.title}]] (${link.fromPath.split(/[\\/]/).pop()}${
                link.reason === 'outside' ? ' — 폴더 밖' : ' — 없음'
              })`}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            취소
          </button>
          <button type="button" onClick={() => void run()} className={BTN_MAIN}>
            그래도 내보내기
          </button>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay onClose={onClose}>
      <h2 className="text-sm font-semibold text-text">폴더 내보내기</h2>
      <p className="mt-2 text-[13px] text-text-secondary">{`"${folderLabel}"`}</p>
      <label className="mt-3 block text-[13px] font-medium text-text">폴더 이름</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value.replace(BAD_CHARS, ''))
          setNameError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) void submitForm()
        }}
        className="mt-1.5 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
      />
      {nameError && <p className="mt-1.5 text-xs text-danger">{nameError}</p>}
      <div className="mt-3 flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-[13px] text-text">
          <input
            type="checkbox"
            checked={useMd}
            onChange={() => setUseMd(!useMd)}
            className="ui-checkbox"
          />
          MD
        </label>
        <label className="flex items-center gap-2 text-[13px] text-text">
          <input
            type="checkbox"
            checked={usePdf}
            onChange={() => setUsePdf(!usePdf)}
            className="ui-checkbox"
          />
          PDF
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN_GHOST}>
          취소
        </button>
        <button
          type="button"
          disabled={!name.trim() || (!useMd && !usePdf)}
          onClick={() => void submitForm()}
          className={BTN_MAIN}
        >
          내보내기
        </button>
      </div>
    </Overlay>
  )
}