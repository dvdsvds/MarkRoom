export interface TocEntry {
  level: number
  text: string
  /** 1부터 시작하는 줄 번호. 에디터로 이동할 때 쓴다. */
  line: number
}

/** 본문에서 제목 줄만 뽑는다. 코드 블록(```) 안의 #은 제외한다. */
export function extractToc(content: string): TocEntry[] {
  const lines = content.split('\n')
  const entries: TocEntry[] = []
  let inFence = false
  lines.forEach((raw, i) => {
    const trimmed = raw.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence
      return
    }
    if (inFence) return
    const match = raw.match(/^(#{1,6})\s+(.+)$/)
    if (!match) return
    entries.push({ level: match[1].length, text: match[2].trim(), line: i + 1 })
  })
  return entries
}
