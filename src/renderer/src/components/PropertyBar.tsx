import { Fragment, useEffect, useRef, useState } from 'react'
import ChevronIcon from '../icons/chevron.svg?react'
import ChevronDownIcon from '../icons/tb-chevron-down.svg?react'
import CloseIcon from '../icons/tb-close.svg?react'
import { useSettingsStore } from '../stores/settingsStore'
import { useNotePropsStore } from '../stores/notePropsStore'
import {
  PROPERTY_COLORS,
  isPropertyVisible,
  type NoteProps,
  type PropertyColor,
  type PropertyDef,
  type PropValue
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

function SelectChip({
  def,
  value,
  onChange,
  clearable = true
}: {
  def: PropertyDef
  value: string | undefined
  onChange: (value: string | null) => void
  clearable?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const options = def.options ?? []
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
            title={def.name}
            className={`flex h-full items-center pl-2.5 outline-none ${clearable ? 'pr-0.5' : 'pr-2.5'}`}
          >
            {value}
          </button>
          {clearable && (
            <button
              type="button"
              onClick={() => onChange(null)}
              title={`${def.name} 지우기`}
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
          {def.name}
          <ChevronDownIcon width={12} height={12} />
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-max min-w-full overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
          {options.length === 0 && (
            <p className="px-2.5 py-1 text-[12px] text-text-tertiary">
              설정에서 값을 추가해 주세요
            </p>
          )}
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

const asString = (v: PropValue | undefined): string | undefined =>
  typeof v === 'string' && v ? v : undefined

/**
 * 노트 위쪽 줄. 설정의 속성 정의를 순서대로 그린다.
 * 다른 속성 값에 따라 보이는 속성(예: 세부)은 그 속성 바로 뒤에 화살표와 함께 붙인다.
 */
export function PropertyBar({
  filePath,
  children
}: {
  filePath: string
  /** 오른쪽 끝에 붙일 것 (데일리 노트 이동 버튼 등) */
  children?: React.ReactNode
}): React.JSX.Element {
  const defs = useSettingsStore((s) => s.propertyDefs)
  const noteProps = useNotePropsStore((s) => s.byPath[filePath])
  const setProps = useNotePropsStore((s) => s.setProps)

  // 1단계: 선택 타입만 그린다. 나머지 타입 입력은 다음 단계에서 붙인다.
  const selectDefs = defs.filter((d) => d.type === 'select')
  const dependentsOf = (id: string): PropertyDef[] =>
    selectDefs.filter((d) => d.showWhen?.prop === id)

  const change = (def: PropertyDef, value: string | null): void => {
    const updates: Record<string, PropValue | null> = { [def.id]: value }
    const after: NoteProps = { ...noteProps, [def.id]: value ?? undefined }
    // 이 값에 따라 보이는 속성은, 보이게 되면 첫 값으로 채우고 안 보이게 되면 지운다
    for (const dep of dependentsOf(def.id)) {
      updates[dep.id] = isPropertyVisible(dep, after)
        ? (asString(noteProps?.[dep.id]) ?? dep.options?.[0]?.label ?? null)
        : null
    }
    setProps(filePath, updates)
  }

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
      {selectDefs
        .filter((d) => !d.showWhen)
        .map((def) => (
          <div key={def.id} className="flex items-center gap-1">
            <SelectChip
              def={def}
              value={asString(noteProps?.[def.id])}
              onChange={(v) => change(def, v)}
            />
            {dependentsOf(def.id)
              .filter((dep) => isPropertyVisible(dep, noteProps))
              .map((dep) => (
                <Fragment key={dep.id}>
                  <ChevronIcon width={14} height={14} className="shrink-0 text-text-tertiary" />
                  <SelectChip
                    def={dep}
                    value={asString(noteProps?.[dep.id])}
                    onChange={(v) => change(dep, v)}
                    clearable={false}
                  />
                </Fragment>
              ))}
          </div>
        ))}
      {children}
    </div>
  )
}
