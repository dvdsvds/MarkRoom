import { fileNameOf } from '@renderer/utils/path';
import { useCallback, useEffect, useState } from 'react'

interface BacklinkWithContext {
  path: string
  count: number
  contexts: { line: number; text: string }[]
}

interface BacklinksPanelProps {
  filePath: string | null
  onOpen: (path: string, line: number) => void
  onClose: () => void
}

function fileTitle(path: string): string {
  const name = fileNameOf(path)
  return name.replace(/\.md$/i, '')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function Snippet({ text, title }: { text: string; title: string }): React.JSX.Element {
  const re = new RegExp(`(\\[\\[\\s*${escapeRegExp(title)}\\s*\\]\\])`)
  const parts = text.split(re)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-accent">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export function BacklinksPanel({
  filePath,
  onOpen,
  onClose
}: BacklinksPanelProps): React.JSX.Element {
  const [links, setLinks] = useState<BacklinkWithContext[] | null>(null)
  const title = filePath ? fileTitle(filePath) : ''

  const load = useCallback(async (): Promise<void> => {
    if (!filePath) {
      setLinks([])
      return
    }
    setLinks(null)
    const result = await window.api.workspace.findBacklinkContexts(filePath)
    const norm = (p: string): string => p.replace(/\\/g, '/')
    setLinks(result.filter((b) => norm(b.path) !== norm(filePath)))
  }, [filePath])

  useEffect(() => {
    void load()
  }, [load])

  const total = links?.reduce((sum, b) => sum + b.count, 0) ?? 0

  return (
    <div className="fixed bottom-9 right-4 z-30 flex max-h-[50vh] w-80 flex-col rounded-xl border border-border bg-bg-elevated p-2 shadow-2xl">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-text-secondary">
          백링크{links && total > 0 ? ` · ${total}` : ''}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void load()}
            title="새로고침"
            className="rounded-md px-1 text-text-tertiary hover:bg-bg-mute hover:text-text"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={onClose}
            title="닫기"
            className="rounded-md px-1 text-text-tertiary hover:bg-bg-mute hover:text-text"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {links === null ? (
          <p className="px-1 py-2 text-xs text-text-tertiary">찾는 중…</p>
        ) : links.length === 0 ? (
          <p className="px-1 py-2 text-xs text-text-tertiary">이 파일을 가리키는 링크가 없어요</p>
        ) : (
          <ul>
            {links.map((b) => (
              <li key={b.path} className="mb-1">
                <button
                  type="button"
                  onClick={() => onOpen(b.path, b.contexts[0]?.line ?? 1)}
                  title={b.path}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-bg-mute"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">
                    {fileTitle(b.path)}
                  </span>
                  <span className="shrink-0 text-xs text-text-tertiary">{b.count}</span>
                </button>
                <ul>
                  {b.contexts.map((c) => (
                    <li key={`${b.path}:${c.line}`}>
                      <button
                        type="button"
                        onClick={() => onOpen(b.path, c.line)}
                        className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left hover:bg-bg-mute"
                      >
                        <span className="mt-px shrink-0 text-[11px] text-text-tertiary">
                          {c.line}
                        </span>
                        <span className="min-w-0 flex-1 break-words text-xs leading-relaxed text-text-secondary">
                          <Snippet text={c.text} title={title} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
