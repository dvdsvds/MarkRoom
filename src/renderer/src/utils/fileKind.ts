export type FileKind = 'text' | 'image' | 'pdf'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])

export function fileKindOf(filePath: string): FileKind {
  const name = filePath.split(/[/\\]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return 'text'
  const ext = name.slice(dot + 1).toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (IMAGE_EXTS.has(ext)) return 'image'
  return 'text'
}