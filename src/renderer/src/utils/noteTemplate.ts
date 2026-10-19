import { addDays, formatDate } from './dateFormat'

export interface NoteTemplate {
  id: string
  name: string
  content: string
}

/** 데일리 노트에 쓰는 템플릿. 지울 수 없고 이름·내용만 바꾼다 */
export const DAILY_TEMPLATE_ID = 'daily'

export const DEFAULT_TEMPLATES: NoteTemplate[] = [
  {
    id: DAILY_TEMPLATE_ID,
    name: '데일리',
    content: '# {{date:YYYY년 M월 D일 dddd}}\n\n## 오늘 할 일\n\n- [ ] \n\n## 메모\n\n'
  },
  {
    id: 'meeting',
    name: '회의록',
    content:
      '# {{title}}\n\n- 날짜: {{date}} {{time}}\n- 참석자: \n\n## 안건\n\n- \n\n## 결정사항\n\n1. \n\n## 할 일\n\n- [ ] \n'
  },
  {
    id: 'weekly',
    name: '주간 회고',
    content:
      '# {{title}}\n\n{{date}} 기준 한 주 회고\n\n## 잘한 점\n\n- \n\n## 아쉬운 점\n\n- \n\n## 다음 주 할 일\n\n- [ ] \n'
  }
]

export const TEMPLATE_VARIABLES_HINT =
  '{{date}} {{time}} {{title}} {{yesterday}} {{tomorrow}} · 형식 지정: {{date:YYYY년 M월 D일 dddd}}'

export interface TemplateContext {
  /** 템플릿을 넣는 날짜. 데일리 노트면 그 노트의 날짜 */
  date: Date
  title: string
  /** {{date}}, {{yesterday}}, {{tomorrow}}에 쓸 형식 */
  dateFormat: string
}

/**
 * 템플릿 안의 변수를 바꾼다.
 * {{date}} {{time}} {{title}} {{yesterday}} {{tomorrow}}, 그리고 {{date:YYYY년 M월}}처럼 형식을 직접 줄 수 있다.
 */
export function applyTemplate(text: string, ctx: TemplateContext): string {
  const now = new Date()
  return text.replace(/\{\{\s*(\w+)(?::([^}]*))?\s*\}\}/g, (whole, name: string, fmt?: string) => {
    const format = fmt?.trim() || ctx.dateFormat
    switch (name.toLowerCase()) {
      case 'date':
        return formatDate(ctx.date, format)
      case 'yesterday':
        return formatDate(addDays(ctx.date, -1), format)
      case 'tomorrow':
        return formatDate(addDays(ctx.date, 1), format)
      case 'time':
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      case 'title':
        return ctx.title
      default:
        return whole
    }
  })
}
