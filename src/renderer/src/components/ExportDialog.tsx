import { useEffect, useState } from 'react'
import { exportPdfBatch } from './exportPdfBatch'
import ExportFolderIcon from '../icons/ctx-export.svg?react'
import ChevronRightIcon from '../icons/tb-chevron-right.svg?react'
import {
  CancelButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  ListBox,
  MainButton
} from './DialogParts'

interface BrokenLink {
  fromPath: string
  title: string
  reason: 'missing' | 'outside'
  /** 링크가 있는 줄 번호 (1부터). 없으면 파일만 연다. */
  line?: number
}

interface ExportDialogProps {
  folderPath: string
  isRoot: boolean
  folderLabel: string
  onClose: () => void
  /** 깨진 링크 줄을 누르면 호출한다. 주면 줄이 눌리는 버튼이 된다. */
  onOpenLink?: (filePath: string, line?: number) => void
}

type Phase = 'loading' | 'form' | 'name' | 'links' | 'working' | 'result'

const REPRESENTATIVE_OPTIONS: { value: 'README' | 'index' | 'main'; label: string }[] = [
  { value: 'README', label: 'README.md (기본)' },
  { value: 'index', label: 'index.md' },
  { value: 'main', label: 'main.md (이름 유지)' }
]

const BAD_CHARS = /[\\/:*?"<>|]/g
const HEAD_ICON = <ExportFolderIcon width={22} height={22} />

export function ExportDialog({
  folderPath,
  isRoot,
  folderLabel,
  onClose,
  onOpenLink
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
        failed = await exportPdfBatch(notes, pdfDir, (done, total) => setProgress({ done, total }))
      }
      void window.api.workspace.openPath(baseDir)
      if (failed.length > 0) {
        setFailures(failed)
        setPhase('result')
      } else {
        onClose()
      }
    } catch {
      setError(
        '내보내기에 실패했어요. 보호 폴더(문서, 사진, 바탕화면)면 Windows 보안이 막을 수 있어요.'
      )
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
      <Dialog onClose={onClose}>
        <DialogHeader icon={HEAD_ICON} title="내보내지 못했어요" subtitle={folderLabel} danger />
        <DialogBody>
          <p className="text-[13px] leading-relaxed text-text-secondary">{error}</p>
        </DialogBody>
        <DialogFooter>
          <CancelButton onClick={onClose}>닫기</CancelButton>
        </DialogFooter>
      </Dialog>
    )
  }

  if (phase === 'working') {
    return (
      <Dialog>
        <DialogHeader icon={HEAD_ICON} title="내보내는 중" subtitle={folderLabel} />
        <DialogBody>
          <p className="text-[13px] text-text-secondary">
            {progress ? `PDF 만드는 중… ${progress.done} / ${progress.total}` : '내보내는 중…'}
          </p>
          {progress && progress.total > 0 && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-bg-mute">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </DialogBody>
      </Dialog>
    )
  }

  if (phase === 'result') {
    return (
      <Dialog onClose={onClose}>
        <DialogHeader
          icon={HEAD_ICON}
          title="일부 PDF를 만들지 못했어요"
          subtitle={folderLabel}
          danger
        />
        <DialogBody>
          <ListBox items={failures} />
        </DialogBody>
        <DialogFooter>
          <CancelButton onClick={onClose}>닫기</CancelButton>
        </DialogFooter>
      </Dialog>
    )
  }

  if (phase === 'name') {
    return (
      <Dialog onClose={onClose}>
        <DialogHeader icon={HEAD_ICON} title="대표 문서 이름" subtitle={folderLabel} />
        <DialogBody>
          <p className="text-[13px] leading-relaxed text-text-secondary">
            루트의 main.md를 MD로 내보낼 때 쓸 이름을 골라주세요.
          </p>
          <div className="mt-3 flex flex-col gap-1">
            {REPRESENTATIVE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-text hover:bg-bg-mute"
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
        </DialogBody>
        <DialogFooter>
          <CancelButton onClick={onClose} />
          <MainButton onClick={afterNameStep}>계속</MainButton>
        </DialogFooter>
      </Dialog>
    )
  }

  if (phase === 'links') {
    return (
      <Dialog width={420} onClose={onClose}>
        <DialogHeader
          icon={HEAD_ICON}
          title={
            <>
              깨진 링크 <span className="text-danger">{brokenLinks.length}</span>개
            </>
          }
          subtitle={folderLabel}
          danger
        />
        <DialogBody>
          <div className="max-h-56 overflow-auto rounded-[10px] bg-bg shadow-[inset_0_0_0_1px_var(--color-border)]">
            {brokenLinks.map((link, i) => {
              const fileName = link.fromPath.split(/[\\/]/).pop()
              const content = (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13px] font-medium text-text">{`[[${link.title}]]`}</div>
                    <div className="mt-0.5 truncate text-xs text-text-tertiary">
                      {link.line ? `${fileName}:${link.line}` : fileName}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-[3px] text-xs font-medium ${
                      link.reason === 'outside'
                        ? 'bg-warning/15 text-warning'
                        : 'bg-danger/15 text-danger'
                    }`}
                  >
                    {link.reason === 'outside' ? '폴더 밖' : '대상 없음'}
                  </span>
                  {onOpenLink && (
                    <ChevronRightIcon
                      width={16}
                      height={16}
                      className="shrink-0 text-text-tertiary transition-[transform,color] duration-150 group-hover:translate-x-[3px] group-hover:text-text"
                    />
                  )}
                </>
              )
              const rowClass = `link-row flex w-full items-center gap-2.5 px-3 py-2.5 ${
                i > 0 ? 'border-t border-border' : ''
              }`
              return onOpenLink ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenLink(link.fromPath, link.line)
                  }}
                  style={{ animationDelay: `${60 + Math.min(i, 8) * 50}ms` }}
                  className={`group ${rowClass} transition-colors hover:bg-bg-mute focus:outline-none`}
                >
                  {content}
                </button>
              ) : (
                <div
                  key={i}
                  style={{ animationDelay: `${60 + Math.min(i, 8) * 50}ms` }}
                  className={rowClass}
                >
                  {content}
                </div>
              )
            })}
          </div>
        </DialogBody>
        <DialogFooter>
          <CancelButton onClick={onClose} />
          <MainButton onClick={() => void run()}>내보내기</MainButton>
        </DialogFooter>
      </Dialog>
    )
  }

  const canSubmit = name.trim() !== '' && (useMd || usePdf)

  return (
    <Dialog onClose={onClose}>
      <DialogHeader icon={HEAD_ICON} title="폴더 내보내기" subtitle={folderLabel} />
      <DialogBody>
        <label className="mb-1.5 block text-xs text-text-tertiary">폴더 이름</label>
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
          className="h-[38px] w-full rounded-[9px] border-0 bg-bg px-3 text-sm text-text shadow-[inset_0_0_0_1px_var(--color-border-strong)] outline-none focus:shadow-[inset_0_0_0_1px_var(--color-accent)]"
        />
        {nameError && <p className="mt-1.5 text-xs text-danger">{nameError}</p>}
        <div className="mt-4 flex gap-5">
          <label className="flex items-center text-[13px] text-text">
            <input
              type="checkbox"
              checked={useMd}
              onChange={() => setUseMd(!useMd)}
              className="ui-checkbox"
            />
            MD
          </label>
          <label className="flex items-center text-[13px] text-text">
            <input
              type="checkbox"
              checked={usePdf}
              onChange={() => setUsePdf(!usePdf)}
              className="ui-checkbox"
            />
            PDF
          </label>
        </div>
      </DialogBody>
      <DialogFooter>
        <CancelButton onClick={onClose} />
        <MainButton disabled={!canSubmit} onClick={() => void submitForm()}>
          내보내기
        </MainButton>
      </DialogFooter>
    </Dialog>
  )
}
