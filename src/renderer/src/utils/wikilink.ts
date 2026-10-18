export interface WikilinkParts {
  /** 대상 노트 제목. `[[#제목]]`처럼 지금 노트를 가리키면 빈 문자열 */
  note: string
  heading: string | null
  alias: string | null
}

/** `[[ ]]` 안쪽 글자를 노트, 제목, 별칭으로 나눈다. 예: `회의록#결정|결정` */
export function parseWikilink(inner: string): WikilinkParts {
  const bar = inner.indexOf('|')
  const target = bar === -1 ? inner : inner.slice(0, bar)
  const alias = bar === -1 ? null : inner.slice(bar + 1).trim() || null
  const hash = target.indexOf('#')
  const note = (hash === -1 ? target : target.slice(0, hash)).trim()
  const heading = hash === -1 ? null : target.slice(hash + 1).trim() || null
  return { note, heading, alias }
}

/** 미리보기에 보일 글자. 별칭이 있으면 별칭, 제목 링크면 `노트 > 제목` */
export function wikilinkLabel({ note, heading, alias }: WikilinkParts): string {
  if (alias) return alias
  if (heading) return note ? `${note} > ${heading}` : heading
  return note
}

export interface HeadingRef {
  text: string
  line: number
}

const HEADING_RE = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/
const FENCE_RE = /^ {0,3}(```|~~~)/

/** 마크다운 본문의 `#` 제목 목록. 코드 블록 안은 건너뛴다. */
export function headingsOf(content: string): HeadingRef[] {
  const out: HeadingRef[] = []
  let fence: string | null = null
  const lines = content.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const fenceMatch = FENCE_RE.exec(lines[i])
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1]
      else if (fence === fenceMatch[1]) fence = null
      continue
    }
    if (fence !== null) continue
    const m = HEADING_RE.exec(lines[i])
    if (m && m[1]) out.push({ text: m[1], line: i + 1 })
  }
  return out
}

const normalizeHeading = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** 제목 글자로 줄 번호(1부터)를 찾는다. 앞뒤 공백과 대소문자는 무시한다. */
export function findHeadingLine(content: string, heading: string): number | null {
  const want = normalizeHeading(heading)
  return headingsOf(content).find((h) => normalizeHeading(h.text) === want)?.line ?? null
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** `[[노트]]`, `[[노트#제목]]`, `[[노트|별칭]]`을 모두 잡는다. 1번 그룹은 `#제목|별칭` 부분 */
export function wikilinkPatternFor(title: string): RegExp {
  return new RegExp(
    `\\[\\[\\s*${escapeRegExp(title)}\\s*((?:#[^\\]|\\n]*)?(?:\\|[^\\]\\n]*)?)\\]\\]`,
    'g'
  )
}
