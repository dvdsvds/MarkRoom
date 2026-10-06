/**
 * 본문(첫 줄 제목 제외)에 h1(`# `)이 더 있는지 본다 (기획 문서 2장:
 * "본문에서는 ##부터 쓰는 걸 권장" 경고). 코드 블록 안의 #은 제외한다.
 */
export function hasExtraH1(content: string): boolean {
  const lines = content.split('\n')
  let inFence = false
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (/^#(?!#)\s/.test(line)) return true
  }
  return false
}
