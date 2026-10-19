export type PropertyColor = 'gray' | 'blue' | 'green' | 'orange' | 'red' | 'yellow' | 'purple'

export type PropertyType =
  'select' | 'multi' | 'date' | 'number' | 'checkbox' | 'text' | 'link' | 'created'

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  select: '선택',
  multi: '여러 개 선택',
  date: '날짜',
  number: '숫자',
  checkbox: '체크박스',
  text: '글자',
  link: '노트 연결',
  created: '만든 날짜'
}

/** 설정에서 고를 수 있는 타입. created는 앱이 기록하는 읽기 전용이라 고를 수 없다 */
export const SELECTABLE_TYPES: PropertyType[] = [
  'select',
  'multi',
  'date',
  'number',
  'checkbox',
  'text',
  'link'
]

export interface PropertyOption {
  label: string
  color: PropertyColor
}

export interface PropertyDef {
  id: string
  name: string
  type: PropertyType
  /** select·multi의 값 목록 */
  options?: PropertyOption[]
  /** 다른 속성이 이 값들 중 하나일 때만 보인다 (예: 세부는 상태가 진행일 때만) */
  showWhen?: { prop: string; values: string[] }
}

export type PropValue = string | number | boolean | string[]
/** 속성 id → 값. created는 앱이 기록한 생성 날짜(YYYY-MM-DD) */
export type NoteProps = Record<string, PropValue | undefined>

export const CREATED_PROP_ID = 'created'

export const DEFAULT_PROPERTY_DEFS: PropertyDef[] = [
  {
    id: 'status',
    name: '상태',
    type: 'select',
    options: [
      { label: '대기', color: 'gray' },
      { label: '진행', color: 'blue' },
      { label: '보류', color: 'orange' },
      { label: '완료', color: 'green' }
    ]
  },
  {
    id: 'substatus',
    name: '세부',
    type: 'select',
    options: [
      { label: '작성', color: 'blue' },
      { label: '검토', color: 'yellow' },
      { label: '수정', color: 'orange' }
    ],
    showWhen: { prop: 'status', values: ['진행'] }
  },
  {
    id: 'priority',
    name: '중요도',
    type: 'select',
    options: [
      { label: '높음', color: 'red' },
      { label: '보통', color: 'yellow' },
      { label: '낮음', color: 'gray' }
    ]
  },
  { id: CREATED_PROP_ID, name: '만든 날짜', type: 'created' }
]

export const PROPERTY_COLORS: Record<PropertyColor, string> = {
  gray: '#8a8a85',
  blue: '#2383e2',
  green: '#2f9e5b',
  orange: '#e07a1f',
  red: '#e5484d',
  yellow: '#c99a06',
  purple: '#8b5cf6'
}

export function findOption(
  def: PropertyDef | undefined,
  label: PropValue | undefined
): PropertyOption | null {
  if (!def?.options || typeof label !== 'string' || !label) return null
  return def.options.find((o) => o.label === label) ?? null
}

/** showWhen 조건을 만족하는지. 조건이 없으면 항상 보인다 */
export function isPropertyVisible(def: PropertyDef, props: NoteProps | undefined): boolean {
  if (!def.showWhen) return true
  const v = props?.[def.showWhen.prop]
  return typeof v === 'string' && def.showWhen.values.includes(v)
}

export function hasValue(v: PropValue | undefined): boolean {
  if (v === undefined || v === '' || v === false) return false
  return !(Array.isArray(v) && v.length === 0)
}

interface LegacyOption extends PropertyOption {
  hasSubstatus?: boolean
}

/** 예전 설정(propertyOptions: 상태·세부·중요도 값 목록)을 새 속성 정의로 옮긴다 */
export function migrateLegacyOptions(
  legacy: Partial<Record<'status' | 'substatus' | 'priority', LegacyOption[]>>
): PropertyDef[] {
  const strip = (
    list: LegacyOption[] | undefined,
    fallback: PropertyOption[] | undefined
  ): PropertyOption[] => (list ?? fallback ?? []).map(({ label, color }) => ({ label, color }))
  const [status, substatus, priority, created] = DEFAULT_PROPERTY_DEFS
  const withSub = (legacy.status ?? []).filter((o) => o.hasSubstatus).map((o) => o.label)
  return [
    { ...status, options: strip(legacy.status, status.options) },
    {
      ...substatus,
      options: strip(legacy.substatus, substatus.options),
      showWhen: { prop: 'status', values: legacy.status ? withSub : ['진행'] }
    },
    { ...priority, options: strip(legacy.priority, priority.options) },
    created
  ]
}
