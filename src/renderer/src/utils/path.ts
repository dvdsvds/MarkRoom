export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function dirOf(path: string): string {
  const idx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return idx >= 0 ? path.slice(0, idx) : path
}

export function sepOf(path: string): string {
  return path.includes('\\') ? '\\' : '/'
}

export function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, ext: '' }
  return { base: name.slice(0, dot), ext: name.slice(dot) }
}

export function newFileNameFor(typed: string): string {
  const trimmed = typed.trim()
  return /^(.*[^.\s])(\.[A-Za-z0-9]{1,8})$/.test(trimmed) ? trimmed : `${trimmed || 'new'}.md`
}