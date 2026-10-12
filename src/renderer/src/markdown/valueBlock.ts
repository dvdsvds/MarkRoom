const FENCE_RE = /^\s*(```|~~~)/
const VALUE_OPEN = /^\s*value\b[^[\]]*\[\s*$/
const TEMPLATE_OPEN = /^\s*template\b[^[\]]*\[\s*$/
const VAR_RE = /^([\p{L}\p{N}_][\p{L}\p{N}_.-]*)\s*:\s*(.*)$/u

export function applyValues(source: string, values: Record<string, string>): string | null {
  const entries = Object.entries(values)
  if (entries.length === 0) return null
  const lines = source.split('\n')

  let valueStart = -1
  let firstTemplate = -1
  let fence = false
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      fence = !fence
      continue
    }
    if (fence) continue
    if (valueStart < 0 && VALUE_OPEN.test(lines[i])) valueStart = i
    if (firstTemplate < 0 && TEMPLATE_OPEN.test(lines[i])) firstTemplate = i
  }

  if (valueStart < 0) {
    if (firstTemplate < 0) return null
    const block = ['value [', ...entries.map(([k, v]) => `  ${k}: ${v}`), ']', '']
    lines.splice(firstTemplate, 0, ...block)
    return lines.join('\n')
  }

  let end = -1
  for (let i = valueStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === ']') {
      end = i
      break
    }
  }
  if (end < 0) return null

  const pending = new Map(entries)
  for (let i = valueStart + 1; i < end; i++) {
    const m = VAR_RE.exec(lines[i].trim())
    if (m && pending.has(m[1])) {
      const indent = /^\s*/.exec(lines[i])?.[0] ?? '  '
      lines[i] = `${indent}${m[1]}: ${pending.get(m[1])}`
      pending.delete(m[1])
    }
  }
  if (pending.size > 0) {
    lines.splice(end, 0, ...[...pending].map(([k, v]) => `  ${k}: ${v}`))
  }
  return lines.join('\n')
}