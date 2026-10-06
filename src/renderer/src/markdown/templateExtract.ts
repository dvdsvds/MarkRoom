export interface TemplateBlock {
  start: number
  end: number
}

const OPEN_RE = /^template\s*\[$/
const OPENER_RE = /^(?:box|table|grid|row|value|template)\b[^[\]]*\[$/
const MAX_LINES = 1500

const indentOf = (s: string): number => s.length - s.trimStart().length

/** 문서에서 template [ ] 블록을 위에서부터 찾는다. start, end는 1부터 시작하는 줄 번호(양 끝 포함). */
export function findTemplateBlocks(src: string): TemplateBlock[] {
  const lines = src.split('\n').map((l) => l.replace(/\r$/, '').replace(/\t/g, '  '))
  const out: TemplateBlock[] = []
  let fence: string | null = null
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(raw)
    if (fence) {
      if (
        f &&
        f[1][0] === fence[0] &&
        f[1].length >= fence.length &&
        raw.trim().slice(f[1].length).trim() === ''
      ) {
        fence = null
      }
      continue
    }
    if (f) {
      fence = f[1]
      continue
    }
    if (indentOf(raw) >= 4 || !OPEN_RE.test(raw.trim())) continue

    let depth = 1
    let end = -1
    for (let j = i + 1; j < lines.length && j - i <= MAX_LINES; j++) {
      const t = lines[j].trim()
      if (OPENER_RE.test(t)) depth++
      else if (t === ']') {
        depth--
        if (depth === 0) {
          end = j
          break
        }
      }
    }
    if (end < 0) continue
    out.push({ start: i + 1, end: end + 1 })
    i = end
  }
  return out
}