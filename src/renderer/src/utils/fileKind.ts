import { fileNameOf, splitName } from "./path"

export type FileKind = 'text' | 'image' | 'pdf' | 'docx' | 'xlsx' | 'external'

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'])
const MARKDOWN_EXTS = new Set(['md', 'markdown'])
// 열어 보지 않아도 바이너리인 게 확실한 확장자. 나머지는 내용을 읽어서 판별한다.
const BINARY_EXTS = new Set([
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'hwpx', 'odt', 'ods', 'odp',
  'zip', '7z', 'rar', 'gz', 'tar', 'bz2', 'xz',
  'exe', 'dll', 'msi', 'dmg', 'app', 'so', 'dylib', 'bin', 'iso',
  'mp3', 'wav', 'flac', 'ogg', 'm4a', 'mp4', 'mov', 'avi', 'mkv', 'webm',
  'bmp', 'ico', 'tif', 'tiff', 'psd', 'heic',
  'ttf', 'otf', 'woff', 'woff2',
  'sqlite', 'db', 'class', 'jar', 'pyc', 'o', 'obj'
])

function extOf(filePath: string): string {
  return splitName(fileNameOf(filePath)).ext.slice(1).toLowerCase()
}

export function fileKindOf(filePath: string): FileKind {
  const ext = extOf(filePath)
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'xlsx') return 'xlsx'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (BINARY_EXTS.has(ext)) return 'external'
  return 'text'
}

export function isMarkdownPath(filePath: string): boolean {
  return MARKDOWN_EXTS.has(extOf(filePath))
}

export type TextReadResult = Awaited<ReturnType<typeof window.api.workspace.readTextFile>>

export async function readTextFile(filePath: string): Promise<TextReadResult> {
  if (fileKindOf(filePath) !== 'text') return { ok: false, reason: 'binary' }
  return window.api.workspace.readTextFile(filePath)
}

/** 텍스트로 읽을 수 없는 파일(바이너리, 너무 큼)이면 예외를 던진다. */
export async function readFileContent(filePath: string): Promise<string> {
  if (fileKindOf(filePath) !== 'text') return ''
  const result = await window.api.workspace.readTextFile(filePath)
  if (!result.ok) throw new Error(result.reason)
  return result.content
}
