export type CalloutColor =
  'blue' | 'cyan' | 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'gray'

export interface CalloutType {
  type: string
  aliases: string[]
  title: string
  color: CalloutColor
  /** 24x24 viewBox 안의 stroke 경로 */
  icon: string
}

export const CALLOUT_TYPES: CalloutType[] = [
  {
    type: 'note',
    aliases: [],
    title: '노트',
    color: 'blue',
    icon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'
  },
  {
    type: 'abstract',
    aliases: ['summary', 'tldr'],
    title: '요약',
    color: 'cyan',
    icon: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M8 11h8M8 15h5"/>'
  },
  {
    type: 'info',
    aliases: [],
    title: '정보',
    color: 'blue',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'
  },
  {
    type: 'todo',
    aliases: [],
    title: '할 일',
    color: 'blue',
    icon: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'
  },
  {
    type: 'tip',
    aliases: ['hint', 'important'],
    title: '팁',
    color: 'cyan',
    icon: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.6 1.4 2.8 2.5 2.8Z"/>'
  },
  {
    type: 'success',
    aliases: ['check', 'done'],
    title: '완료',
    color: 'green',
    icon: '<path d="M20 6 9 17l-5-5"/>'
  },
  {
    type: 'question',
    aliases: ['help', 'faq'],
    title: '질문',
    color: 'yellow',
    icon: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'
  },
  {
    type: 'warning',
    aliases: ['caution', 'attention'],
    title: '주의',
    color: 'orange',
    icon: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>'
  },
  {
    type: 'failure',
    aliases: ['fail', 'missing'],
    title: '실패',
    color: 'red',
    icon: '<path d="M18 6 6 18M6 6l12 12"/>'
  },
  {
    type: 'danger',
    aliases: ['error'],
    title: '위험',
    color: 'red',
    icon: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>'
  },
  {
    type: 'bug',
    aliases: [],
    title: '버그',
    color: 'red',
    icon: '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M20 13h-4M4 13h4M10 4l1 2M14 4l-1 2"/>'
  },
  {
    type: 'example',
    aliases: [],
    title: '예시',
    color: 'purple',
    icon: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
  },
  {
    type: 'quote',
    aliases: ['cite'],
    title: '인용',
    color: 'gray',
    icon: '<path d="M3 21c3 0 7-1 7-8V5c0-1.2-.8-2-2-2H4c-1.2 0-2 .8-2 2v6c0 1.2.8 2 2 2h3c0 3-1 5-4 5Z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.2-.8-2-2-2h-4c-1.2 0-2 .8-2 2v6c0 1.2.8 2 2 2h3c0 3-1 5-4 5Z"/>'
  }
]

/** 에디터 원문 색칠용. 미리보기 색은 preview.css의 같은 값 */
export const CALLOUT_COLOR_HEX: Record<CalloutColor, string> = {
  blue: '#2383e2',
  cyan: '#0e9fb5',
  green: '#2f9e5b',
  yellow: '#c99a06',
  orange: '#e07a1f',
  red: '#e5484d',
  purple: '#8b5cf6',
  gray: '#8a8a85'
}

const BY_NAME = new Map<string, CalloutType>()
for (const t of CALLOUT_TYPES) {
  BY_NAME.set(t.type, t)
  for (const a of t.aliases) BY_NAME.set(a, t)
}

/** 종류 이름(별칭 포함, 대소문자 무시)으로 찾는다. 모르는 종류면 null */
export function findCalloutType(name: string): CalloutType | null {
  return BY_NAME.get(name.toLowerCase()) ?? null
}

/** 인용문 첫 줄 `[!종류]+ 제목`을 읽는다. 콜아웃이 아니면 null */
export const CALLOUT_HEAD_RE = /^\[!([^\]\s]+)\]([+-]?)[ \t]*(.*)$/

export function calloutIconSvg(type: CalloutType): string {
  return `<svg class="callout-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${type.icon}</svg>`
}
