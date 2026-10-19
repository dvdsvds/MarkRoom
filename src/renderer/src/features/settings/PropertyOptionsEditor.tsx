import { useState } from 'react'
import { useNotePropsStore } from '../../stores/notePropsStore'
import { useToastStore } from '../../stores/toastStore'
import {
  PROPERTY_COLORS,
  type PropertyColor,
  type PropertyOption
} from '../../utils/noteProperties'
import { INPUT } from './SettingsParts'

const COLOR_NAMES = Object.keys(PROPERTY_COLORS) as PropertyColor[]

const ICON_BTN =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-[13px] text-text-tertiary outline-none transition-colors hover:text-text disabled:opacity-30 disabled:hover:text-text-tertiary'

function OptionRow({
  option,
  first,
  last,
  confirmCount,
  onRename,
  onChange,
  onMove,
  onDelete,
  onConfirmDelete,
  onCancelDelete
}: {
  option: PropertyOption
  first: boolean
  last: boolean
  confirmCount: number | null
  onRename: (name: string) => boolean
  onChange: (next: PropertyOption) => void
  onMove: (dir: -1 | 1) => void
  onDelete: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(option.label)

  const commit = (): void => {
    if (!onRename(draft)) setDraft(option.label)
  }

  return (
    <div className="px-3.5 py-2">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className={`${INPUT} min-w-0 flex-1 font-medium`}
          style={{ color: PROPERTY_COLORS[option.color] }}
        />
        <div className="flex shrink-0 items-center gap-1">
          {COLOR_NAMES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange({ ...option, color: c })}
              className={`h-3.5 w-3.5 rounded-full outline-none transition-transform ${
                option.color === c
                  ? 'ring-2 ring-text/60 ring-offset-1 ring-offset-bg'
                  : 'hover:scale-110'
              }`}
              style={{ background: PROPERTY_COLORS[c] }}
            />
          ))}
        </div>
        <button
          type="button"
          title="위로"
          disabled={first}
          onClick={() => onMove(-1)}
          className={ICON_BTN}
        >
          ↑
        </button>
        <button
          type="button"
          title="아래로"
          disabled={last}
          onClick={() => onMove(1)}
          className={ICON_BTN}
        >
          ↓
        </button>
        <button
          type="button"
          title="삭제"
          onClick={onDelete}
          className={`${ICON_BTN} hover:!text-danger`}
        >
          ✕
        </button>
      </div>
      {confirmCount !== null && (
        <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-text-secondary">
          <span>{confirmCount}개 노트에서 이 값이 지워져요</span>
          <button type="button" onClick={onConfirmDelete} className="text-danger outline-none">
            삭제
          </button>
          <button type="button" onClick={onCancelDelete} className="outline-none hover:text-text">
            취소
          </button>
        </div>
      )}
    </div>
  )
}

/** 선택·여러 개 선택 속성의 값 목록(이름, 색, 순서) 편집. 이름을 바꾸면 노트의 값도 같이 바뀐다 */
export function PropertyOptionsEditor({
  propKey,
  options,
  onOptionsChange
}: {
  propKey: string
  options: PropertyOption[]
  onOptionsChange: (options: PropertyOption[]) => void
}): React.JSX.Element {
  // 값마다 쓰는 노트 수를 다시 세려고 구독만 해 둔다
  useNotePropsStore((s) => s.byPath)
  const countWithValue = useNotePropsStore((s) => s.countWithValue)
  const renameValue = useNotePropsStore((s) => s.renameValue)
  const pushToast = useToastStore((s) => s.push)
  const [confirming, setConfirming] = useState<string | null>(null)

  const countOf = (label: string): number => countWithValue(propKey, label)

  const rename = (option: PropertyOption, name: string): boolean => {
    const next = name.trim()
    if (next === option.label) return true
    if (!next) {
      pushToast({ kind: 'info', message: '이름을 비워 둘 수 없어요.' })
      return false
    }
    if (options.some((o) => o.label === next)) {
      pushToast({ kind: 'info', message: '같은 이름이 이미 있어요.' })
      return false
    }
    onOptionsChange(options.map((o) => (o === option ? { ...o, label: next } : o)))
    renameValue(propKey, option.label, next)
    return true
  }

  const update = (option: PropertyOption, next: PropertyOption): void => {
    onOptionsChange(options.map((o) => (o === option ? next : o)))
  }

  const move = (index: number, dir: -1 | 1): void => {
    const list = [...options]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    onOptionsChange(list)
  }

  const remove = (option: PropertyOption): void => {
    onOptionsChange(options.filter((o) => o !== option))
    renameValue(propKey, option.label, null)
    setConfirming(null)
  }

  const add = (): void => {
    let name = '새 값'
    let n = 2
    while (options.some((o) => o.label === name)) name = `새 값 ${n++}`
    onOptionsChange([...options, { label: name, color: 'gray' }])
  }

  return (
    <div className="py-1">
      {options.map((option, i) => {
        const count = countOf(option.label)
        return (
          <OptionRow
            key={option.label}
            option={option}
            first={i === 0}
            last={i === options.length - 1}
            confirmCount={confirming === option.label ? count : null}
            onRename={(name) => rename(option, name)}
            onChange={(next) => update(option, next)}
            onMove={(dir) => move(i, dir)}
            onDelete={() => (count === 0 ? remove(option) : setConfirming(option.label))}
            onConfirmDelete={() => remove(option)}
            onCancelDelete={() => setConfirming(null)}
          />
        )
      })}
      <div className="px-3.5 py-2">
        <button
          type="button"
          onClick={add}
          className="text-[13px] text-text-tertiary outline-none transition-colors hover:text-accent"
        >
          + 값 추가
        </button>
      </div>
    </div>
  )
}
