import { fileNameOf, splitName } from "./path"

export type FileKind = 'text' | 'image' | 'pdf' | 'external'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
const TEXT_EXTS = new Set(['', 'md', 'markdown', 'txt', 'csv', 'tsv', 'json'])

export function fileKindOf(filePath: string): FileKind {
  const ext = splitName(fileNameOf(filePath)).ext.slice(1).toLocaleLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (TEXT_EXTS.has(ext)) return 'text'
  return 'external'
}

export async function readFileContent(filePath: string): Promise<string> {
  if (fileKindOf(filePath) !== 'text') return ''
  return window.api.workspace.readFile(filePath)
}