import { useEffect, useRef, useState } from 'react'
import { getCurrentView } from '../editor/currentView'
import {
  COLUMN_COLORS,
  delimiterLabel,
  setCsvConfig,
  useCsvStatus,
  type CsvConfig
} from '../editor/csvColumns'

const MENU_DELIMITERS = [',', ';', '\t', '|', ', ', '||', '^', '~', ':']

const ITEM =
  'flex h-7 w-full items-center gap-2 rounded px-2 text-left text-[12px] text-text-secondary outline-none hover:bg-bg-mute hover:text-text'

function applyConfig(config: Partial<CsvConfig>): void {
  getCurrentView()?.dispatch({ effects: setCsvConfig.of(config) })
}

export function CsvStatus(): React.JSX.Element | null {
  const status = useCsvStatus()
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  if (!status.active) return null

  const pick = (delimiter: string | null): void => {
    applyConfig({ delimiter })
    setOpen(false)
  }

  const colorIndex = status.column !== null ? (status.column - 1) % COLUMN_COLORS : 0

  return (
    <>
      {status.delimiter && status.column !== null && (
        <span className="truncate">
          {status.column}번째 컬럼
          {status.columnName && (
            <span className="ml-1" style={{ color: `var(--csv-c${colorIndex})` }}>
              {status.columnName}
            </span>
          )}
        </span>
      )}
      <div ref={boxRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="구분자 바꾸기"
          className="hover:text-text"
        >
          구분자: {delimiterLabel(status.delimiter)}
        </button>
        {open && (
          <div className="absolute bottom-full right-0 z-50 mb-1 w-48 rounded-lg border border-border bg-bg-elevated p-1 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            {MENU_DELIMITERS.map((d) => (
              <button key={d} type="button" onClick={() => pick(d)} className={ITEM}>
                <span className="w-3">{status.delimiter === d ? '✓' : ''}</span>
                {delimiterLabel(d)}
                {d.length > 1 || d === '\t' ? null : (
                  <span className="ml-auto font-mono text-text-tertiary">{d}</span>
                )}
              </button>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (custom) {
                  pick(custom)
                  setCustom('')
                }
              }}
              className="flex items-center gap-2 px-2 py-1"
            >
              <span className="w-3" />
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="기타 (입력 후 Enter)"
                className="h-6 min-w-0 flex-1 rounded bg-text/[0.07] px-1.5 text-[12px] text-text outline-none placeholder:text-text-tertiary"
              />
            </form>
            <button type="button" onClick={() => pick(null)} className={ITEM}>
              <span className="w-3">{status.delimiter === null ? '✓' : ''}</span>
              끄기
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={() => applyConfig({ header: !status.header })}
              className={ITEM}
            >
              <span className="w-3">{status.header ? '✓' : ''}</span>첫 줄은 컬럼 이름
            </button>
          </div>
        )}
      </div>
    </>
  )
}
