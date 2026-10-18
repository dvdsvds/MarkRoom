import { useEffect, useRef, useState } from 'react'
import ChevronIcon from '../icons/chevron.svg?react'
import ChevronDownIcon from '../icons/tb-chevron-down.svg?react'
import CloseIcon from '../icons/tb-close.svg?react'
import { useSettingsStore } from '../stores/settingsStore'
import { useNotePropsStore } from '../stores/notePropsStore'
import {
  PROPERTY_COLORS,
  PROPERTY_LABELS,
  findOption,
  type PropertyColor,
  type PropertyKey,
  type PropertyOption
} from '../utils/noteProperties'

function Chip({ label, color }: { label: string; color: PropertyColor }): React.JSX.Element {
  const c = PROPERTY_COLORS[color]
  return (
    <span
      className="flex h-[22px] w-full items-center justify-center rounded-md px-1 text-[12px] font-medium"
      style={{ background: `${c}26`, color: c }}
    >
      {label}
    </span>
  )
}

function TagSelect({
  propKey,
  value,
  options,
  onChange,
  clearable = true
}: {
  propKey: PropertyKey
  value: string | undefined
  options: PropertyOption[]
  onChange: (value: string | null) => void
  clearable?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const current = value ? (options.find((o) => o.label === value) ?? null) : null
  const chipColor = PROPERTY_COLORS[current?.color ?? 'gray']

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

  const pick = (next: string | null): void => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative flex items-center">
      {value ? (
        <span
          className="flex h-[22px] items-center rounded-md text-[12px] font-medium"
          style={{ background: `${chipColor}26`, color: chipColor }}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title={PROPERTY_LABELS[propKey]}
            className={`flex h-full items-center pl-2.5 outline-none ${clearable ? 'pr-0.5' : 'pr-2.5'}`}
          >
            {value}
          </button>
          {clearable && (
            <button
              type="button"
              onClick={() => onChange(null)}
              title={`${PROPERTY_LABELS[propKey]} 지우기`}
              className="mr-1 flex h-4 w-4 items-center justify-center rounded opacity-60 outline-none transition-opacity hover:bg-black/10 hover:opacity-100"
            >
              <CloseIcon width={12} height={12} />
            </button>
          )}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-[22px] items-center gap-0.5 rounded-md border border-dashed border-border-strong pl-2 pr-1 text-[12px] text-text-tertiary outline-none transition-colors hover:bg-bg-mute hover:text-text-secondary"
        >
          {PROPERTY_LABELS[propKey]}
          <ChevronDownIcon width={12} height={12} />
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-max min-w-full overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => pick(o.label)}
              className="flex h-7 w-full items-center px-1 transition-opacity hover:opacity-80"
            >
              <Chip label={o.label} color={o.color} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TagBar({ filePath }: { filePath: string }): React.JSX.Element {
  const options = useSettingsStore((s) => s.propertyOptions)
  const noteProps = useNotePropsStore((s) => s.byPath[filePath])
  const setProps = useNotePropsStore((s) => s.setProps)
  const status = findOption(options, 'status', noteProps?.status)

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
      <div className="flex items-center gap-1">
        <TagSelect
          propKey="status"
          value={noteProps?.status}
          options={options.status}
          onChange={(value) => {
            const next = findOption(options, 'status', value ?? undefined)
            setProps(filePath, {
              status: value,
              substatus: next?.hasSubstatus
                ? (noteProps?.substatus ?? options.substatus[0]?.label ?? null)
                : null
            })
          }}
        />
        {status?.hasSubstatus && (
          <ChevronIcon width={14} height={14} className="shrink-0 text-text-tertiary" />
        )}
        {status?.hasSubstatus && (
          <TagSelect
            propKey="substatus"
            value={noteProps?.substatus}
            options={options.substatus}
            onChange={(value) => setProps(filePath, { substatus: value })}
            clearable={false}
          />
        )}
      </div>
      <TagSelect
        propKey="priority"
        value={noteProps?.priority}
        options={options.priority}
        onChange={(value) => setProps(filePath, { priority: value })}
      />
    </div>
  )
}