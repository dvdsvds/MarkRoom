const DAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']

// 긴 토큰이 먼저 와야 `YYYY`가 `YY` 두 번으로 잘리지 않는다
const TOKEN_RE = /YYYY|YY|MM|M|DD|D|dddd|ddd/g

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * 날짜를 형식에 맞춰 글자로 바꾼다.
 * 토큰: YYYY YY MM M DD D ddd(월) dddd(월요일). 그 밖의 글자는 그대로 둔다.
 */
export function formatDate(date: Date, format: string): string {
  return format.replace(TOKEN_RE, (t) => {
    switch (t) {
      case 'YYYY':
        return String(date.getFullYear())
      case 'YY':
        return String(date.getFullYear()).slice(-2)
      case 'MM':
        return pad(date.getMonth() + 1)
      case 'M':
        return String(date.getMonth() + 1)
      case 'DD':
        return pad(date.getDate())
      case 'D':
        return String(date.getDate())
      case 'ddd':
        return DAY_SHORT[date.getDay()]
      default:
        return `${DAY_SHORT[date.getDay()]}요일`
    }
  })
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** formatDate의 반대. 형식과 맞지 않거나 없는 날짜면 null */
export function parseDate(text: string, format: string): Date | null {
  const order: string[] = []
  let last = 0
  let source = ''
  for (const m of format.matchAll(TOKEN_RE)) {
    source += escapeRegExp(format.slice(last, m.index))
    const t = m[0]
    order.push(t)
    if (t === 'YYYY') source += '(\\d{4})'
    else if (t === 'YY' || t === 'MM' || t === 'DD') source += '(\\d{2})'
    else if (t === 'M' || t === 'D') source += '(\\d{1,2})'
    else if (t === 'ddd') source += '([일월화수목금토])'
    else source += '([일월화수목금토]요일)'
    last = (m.index ?? 0) + t.length
  }
  source += escapeRegExp(format.slice(last))
  const m = new RegExp(`^${source}$`).exec(text)
  if (!m) return null
  let year = NaN
  let month = NaN
  let day = NaN
  order.forEach((t, i) => {
    const v = m[i + 1]
    if (t === 'YYYY') year = Number(v)
    else if (t === 'YY') year = 2000 + Number(v)
    else if (t === 'MM' || t === 'M') month = Number(v)
    else if (t === 'DD' || t === 'D') day = Number(v)
  })
  if ([year, month, day].some(Number.isNaN)) return null
  const date = new Date(year, month - 1, day)
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
