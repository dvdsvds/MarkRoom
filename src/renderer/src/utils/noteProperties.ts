export type PropertyKey = 'status' | 'substatus' | 'priority'
export type PropertyColor = 'gray' | 'blue' | 'green' | 'orange' | 'red' | 'yellow' | 'purple'
/** created: 앱이 기록한 생성 날짜(YYYY-MM-DD). 태그바에서 고르는 값은 아니다 */
export type NoteProps = Partial<Record<PropertyKey | 'created', string>>

export interface PropertyOption {
  label: string
  color: PropertyColor
  hasSubstatus?: boolean
}

export type PropertyOptions = Record<PropertyKey, PropertyOption[]>

export const PROPERTY_LABELS: Record<PropertyKey, string> = {
  status: '상태',
  substatus: '세부',
  priority: '중요도',
}

export const DEFAULT_PROPERTY_OPTIONS: PropertyOptions = {
  status: [
    { label: '대기', color: 'gray' },
    { label: '진행', color: 'blue', hasSubstatus: true },
    { label: '보류', color: 'orange' },
    { label: '완료', color: 'green' }
  ],
  substatus: [
    { label: '작성', color: 'blue' },
    { label: '검토', color: 'yellow' },
    { label: '수정', color: 'orange' }
  ],
  priority: [
    { label: '높음', color: 'red' },
    { label: '보통', color: 'yellow' },
    { label: '낮음', color: 'gray' }
  ]
}

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
  options: PropertyOptions,
  key: PropertyKey,
  label: string | undefined
): PropertyOption | null {
  if (!label) return null
  return options[key].find((o) => o.label === label) ?? null
}
