export function toggleTaskAtLine(content: string, line: number): string | null {
  const lines = content.split('\n')
  const raw = lines[line]
  if (raw === undefined) return null
  const m = /^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/.exec(raw)
  if (!m) return null
  lines[line] = m[1] + (m[2] === ' ' ? 'x' : ' ') + raw.slice(m[0].length - 1)
  return lines.join('\n')
}