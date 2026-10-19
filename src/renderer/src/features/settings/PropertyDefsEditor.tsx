import { useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useNotePropsStore } from '../../stores/notePropsStore'
import { useToastStore } from '../../stores/toastStore'
import {
  CREATED_PROP_ID,
  PROPERTY_TYPE_LABELS,
  SELECTABLE_TYPES,
  type PropertyDef,
  type PropertyType
} from '../../utils/noteProperties'
import { PropertyOptionsEditor } from './PropertyOptionsEditor'
import { Checkbox, INPUT } from './SettingsParts'
import ChevronIcon from '../../icons/chevron.svg?react'

const ICON_BTN =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-[13px] text-text-tertiary outline-none transition-colors hover:text-text disabled:opacity-30 disabled:hover:text-text-tertiary'

const LINK_BTN = 'text-[12.5px] outline-none transition-colors'

type Pending = { kind: 'delete' } | { kind: 'type'; to: PropertyType }

/** 다른 속성이 특정 값일 때만 보이게 하는 설정 (예: 세부는 상태가 진행일 때만) */
function ShowWhenEditor({
  def,
  defs,
  onChange
}: {
  def: PropertyDef
  defs: PropertyDef[]
  onChange: (def: PropertyDef) => void
}): React.JSX.Element {
  const parents = defs.filter((d) => d.id !== def.id && d.type === 'select' && !d.showWhen)
  const parent = parents.find((d) => d.id === def.showWhen?.prop)
  return (
    <div className="px-3.5 py-2 text-[12.5px] text-text-secondary">
      <div className="flex items-center gap-2">
        <span>보이는 조건</span>
        <select
          value={def.showWhen?.prop ?? ''}
          onChange={(e) =>
            onChange({
              ...def,
              showWhen: e.target.value ? { prop: e.target.value, values: [] } : undefined
            })
          }
          className={`${INPUT} h-7 text-[12.5px]`}
        >
          <option value="">항상 보이기</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}이(가) 이 값일 때만
            </option>
          ))}
        </select>
      </div>
      {parent && def.showWhen && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 pl-0.5">
          {(parent.options ?? []).map((o) => {
            const values = def.showWhen?.values ?? []
            const on = values.includes(o.label)
            return (
              <Checkbox
                key={o.label}
                checked={on}
                label={o.label}
                onChange={() =>
                  onChange({
                    ...def,
                    showWhen: {
                      prop: parent.id,
                      values: on ? values.filter((v) => v !== o.label) : [...values, o.label]
                    }
                  })
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function DefCard({
  def,
  defs,
  index,
  open,
  onToggle
}: {
  def: PropertyDef
  defs: PropertyDef[]
  index: number
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  const setDefs = useSettingsStore((s) => s.setPropertyDefs)
  const updateDef = useSettingsStore((s) => s.updatePropertyDef)
  useNotePropsStore((s) => s.byPath)
  const countWithValue = useNotePropsStore((s) => s.countWithValue)
  const clearProperty = useNotePropsStore((s) => s.clearProperty)
  const pushToast = useToastStore((s) => s.push)
  const [draft, setDraft] = useState(def.name)
  const [pending, setPending] = useState<Pending | null>(null)
  const readOnly = def.id === CREATED_PROP_ID
  const count = countWithValue(def.id)

  const commitName = (): void => {
    const name = draft.trim()
    if (name === def.name) return
    if (!name || defs.some((d) => d.id !== def.id && d.name === name)) {
      pushToast({
        kind: 'info',
        message: name ? '같은 이름의 속성이 있어요.' : '이름을 비워 둘 수 없어요.'
      })
      setDraft(def.name)
      return
    }
    updateDef({ ...def, name })
  }

  const move = (dir: -1 | 1): void => {
    const list = [...defs]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    setDefs(list)
  }

  const applyType = (to: PropertyType): void => {
    clearProperty(def.id)
    const needsOptions = to === 'select' || to === 'multi'
    updateDef({
      ...def,
      type: to,
      options: needsOptions ? (def.options ?? []) : undefined,
      showWhen: to === 'select' ? def.showWhen : undefined
    })
    setPending(null)
  }

  const remove = (): void => {
    clearProperty(def.id)
    // 이 속성에 따라 보이던 속성은 조건을 없애서 항상 보이게 한다
    setDefs(
      defs
        .filter((d) => d.id !== def.id)
        .map((d) => (d.showWhen?.prop === def.id ? { ...d, showWhen: undefined } : d))
    )
  }

  const askType = (to: PropertyType): void => {
    if (to === def.type) return
    // 선택 ↔ 여러 개 선택은 값 목록을 그대로 쓸 수 있지만, 저장된 값 형태가 달라 지금은 지운다
    if (count > 0) setPending({ kind: 'type', to })
    else applyType(to)
  }

  return (
    <div className="border-t border-border first:border-t-0">
      <div className="flex items-center gap-2 px-3.5 py-2">
        <button
          type="button"
          onClick={onToggle}
          disabled={readOnly}
          className={`${ICON_BTN} ${readOnly ? 'invisible' : ''}`}
          title={open ? '접기' : '펼치기'}
        >
          <ChevronIcon
            width={12}
            height={12}
            className="transition-transform"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className={`${INPUT} min-w-0 flex-1 font-medium`}
        />
        {readOnly ? (
          <span className="w-28 shrink-0 text-[12px] text-text-tertiary">앱이 기록</span>
        ) : (
          <select
            value={def.type}
            onChange={(e) => askType(e.target.value as PropertyType)}
            className={`${INPUT} h-7 w-28 shrink-0 text-[12.5px]`}
          >
            {SELECTABLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {PROPERTY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          title="위로"
          disabled={index === 0}
          onClick={() => move(-1)}
          className={ICON_BTN}
        >
          ↑
        </button>
        <button
          type="button"
          title="아래로"
          disabled={index === defs.length - 1}
          onClick={() => move(1)}
          className={ICON_BTN}
        >
          ↓
        </button>
        <button
          type="button"
          title={readOnly ? '만든 날짜는 지울 수 없어요' : '삭제'}
          disabled={readOnly}
          onClick={() => (count > 0 ? setPending({ kind: 'delete' }) : remove())}
          className={`${ICON_BTN} hover:!text-danger`}
        >
          ✕
        </button>
      </div>
      {pending && (
        <div className="flex items-center gap-3 px-3.5 pb-2 pl-12 text-[12.5px] text-text-secondary">
          <span>
            {pending.kind === 'delete'
              ? `${count}개 노트에서 이 속성 값이 지워져요`
              : `타입을 ${PROPERTY_TYPE_LABELS[pending.to]}(으)로 바꾸면 ${count}개 노트의 값이 지워져요`}
          </span>
          <button
            type="button"
            onClick={() => (pending.kind === 'delete' ? remove() : applyType(pending.to))}
            className={`${LINK_BTN} text-danger`}
          >
            {pending.kind === 'delete' ? '삭제' : '바꾸기'}
          </button>
          <button
            type="button"
            onClick={() => setPending(null)}
            className={`${LINK_BTN} hover:text-text`}
          >
            취소
          </button>
        </div>
      )}
      {open && !readOnly && (
        <div className="mb-1 ml-10 mr-3.5 rounded-lg bg-bg/60">
          {(def.type === 'select' || def.type === 'multi') && (
            <PropertyOptionsEditor
              propKey={def.id}
              options={def.options ?? []}
              onOptionsChange={(options) => updateDef({ ...def, options })}
            />
          )}
          {def.type === 'select' && <ShowWhenEditor def={def} defs={defs} onChange={updateDef} />}
          {def.type !== 'select' && def.type !== 'multi' && (
            <p className="px-3.5 py-2.5 text-[12.5px] text-text-tertiary">
              {PROPERTY_TYPE_LABELS[def.type]} 속성은 따로 정할 값 목록이 없어요
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** 설정 > 속성: 속성 추가·이름·타입·순서·삭제, 선택 속성의 값 목록과 보이는 조건 */
export function PropertyDefsEditor(): React.JSX.Element {
  const defs = useSettingsStore((s) => s.propertyDefs)
  const setDefs = useSettingsStore((s) => s.setPropertyDefs)
  const [openId, setOpenId] = useState<string | null>(null)

  const add = (): void => {
    let name = '새 속성'
    let n = 2
    while (defs.some((d) => d.name === name)) name = `새 속성 ${n++}`
    const def: PropertyDef = {
      id: `p-${crypto.randomUUID().slice(0, 8)}`,
      name,
      type: 'select',
      options: []
    }
    setDefs([...defs, def])
    setOpenId(def.id)
  }

  return (
    <div className="py-1">
      {defs.map((def, i) => (
        <DefCard
          key={def.id}
          def={def}
          defs={defs}
          index={i}
          open={openId === def.id}
          onToggle={() => setOpenId(openId === def.id ? null : def.id)}
        />
      ))}
      <div className="border-t border-border px-3.5 py-2.5">
        <button
          type="button"
          onClick={add}
          className="text-[13px] text-text-tertiary outline-none transition-colors hover:text-accent"
        >
          + 속성 추가
        </button>
      </div>
    </div>
  )
}
