import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { shell } from 'electron'
import { assertInsideRoot } from './paths'

const FORBIDDEN_FILENAME_CHARS = /[/\\:?*"<>|]/g

export function sanitizeTitle(rawTitle: string): string {
  const cleaned = rawTitle.replace(FORBIDDEN_FILENAME_CHARS, ' ').trim().replace(/\s+/g, ' ')
  return cleaned.length > 0 ? cleaned : '제목 없음'
}

export function sanitizeFileName(rawName: string): string {
  const cleaned = rawName.replace(FORBIDDEN_FILENAME_CHARS, ' ').trim()
  return cleaned.length > 0 ? cleaned : '이름 없음'
}

export function uniqueFileName(dir: string, baseTitle: string, ignorePath?: string): string {
  let candidate = `${baseTitle}.md`
  let n = 2
  while (existsSync(join(dir, candidate)) && join(dir, candidate) !== ignorePath) {
    candidate = `${baseTitle} ${n}.md`
    n += 1
  }
  return candidate
}

export function createEmptyNote(dirPath: string, rawTitle: string): string {
  const safeDir = assertInsideRoot(dirPath)
  if (!existsSync(safeDir)) mkdirSync(safeDir, { recursive: true })

  const extMatch = rawTitle.trim().match(/^(.*[^.\s])(\.[A-Za-z0-9]{1,8})$/)
  const base = sanitizeTitle(extMatch ? extMatch[1] : rawTitle)
  const ext = extMatch ? extMatch[2].toLowerCase() : '.md'

  let name = `${base}${ext}`
  let n = 2
  while (existsSync(join(safeDir, name))) {
    name = `${base} ${n}${ext}`
    n += 1
  }
  const finalPath = join(safeDir, name)
  writeFileSync(finalPath, '', 'utf-8')
  return finalPath
}

export function readNote(filePath: string): string {
  const safePath = assertInsideRoot(filePath)
  return readFileSync(safePath, 'utf-8')
}

const MAX_TEXT_BYTES = 20 * 1024 * 1024
const BINARY_SNIFF_BYTES = 8192

export type TextReadResult =
  | { ok: true; content: string }
  | { ok: false; reason: 'binary' | 'tooLarge' }

export function readTextFile(filePath: string): TextReadResult {
  const safePath = assertInsideRoot(filePath)
  if (statSync(safePath).size > MAX_TEXT_BYTES) return { ok: false, reason: 'tooLarge' }
  const buf = readFileSync(safePath)
  if (buf.subarray(0, BINARY_SNIFF_BYTES).includes(0)) return { ok: false, reason: 'binary' }
  return { ok: true, content: buf.toString('utf-8') }
}

export function writeFileAtomic(filePath: string, content: string): void {
  const safePath = assertInsideRoot(filePath)
  const dir = dirname(safePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tmpPath = join(dir, `.${basename(safePath)}.tmp`)
  writeFileSync(tmpPath, content, 'utf-8')
  renameSync(tmpPath, safePath)
}

export function createFolder(dirPath: string): void {
  const safePath = assertInsideRoot(dirPath)
  mkdirSync(safePath, { recursive: true })
}

export async function trashEntry(targetPath: string): Promise<void> {
  const safePath = assertInsideRoot(targetPath)
  await shell.trashItem(safePath)
}

export function renameEntry(oldPath: string, newPath: string): void {
  const safeOld = assertInsideRoot(oldPath)
  const safeNew = assertInsideRoot(newPath)
  if (existsSync(safeNew) && !isSameEntry(safeOld, safeNew)) {
    throw new Error('같은 이름의 파일이 존재해요.')
  }
  renameSync(safeOld, safeNew)
}

function isSameEntry(a: string, b: string): boolean {
  const statA = statSync(a, { bigint: true })
  const statB = statSync(b, { bigint: true })
  return statA.dev === statB.dev && statA.ino === statB.ino
}

export function uniqueEntryName(targetDir: string, name: string): string {
  const ext = extname(name)
  const stem = ext ? name.slice(0, -ext.length) : name
  let candidate = name
  let n = 2
  while (existsSync(join(targetDir, candidate))) {
    candidate = `${stem} ${n}${ext}`
    n += 1
  }
  return candidate
}

export function moveEntry(
  sourcePath: string,
  targetDirPath: string,
  beforeMove?: (destination: string) => void
): string {
  const safeSource = assertInsideRoot(sourcePath)
  const safeTargetDir = assertInsideRoot(targetDirPath)
  const name = uniqueEntryName(safeTargetDir, basename(safeSource))
  const destination = join(safeTargetDir, name)
  beforeMove?.(destination)
  renameSync(safeSource, destination)
  return destination
}

export function saveAttachment(
  noteDirPath: string,
  kind: 'img' | 'files',
  fileName: string,
  data: Buffer
): string {
  const safeNoteDir = assertInsideRoot(noteDirPath)
  const subDir = join(safeNoteDir, kind)
  if (!existsSync(subDir)) mkdirSync(subDir, { recursive: true })
  const finalName = uniqueEntryName(subDir, sanitizeFileName(fileName))
  writeFileSync(join(subDir, finalName), data)
  return `${kind}/${finalName}`
}

export function revealInFolder(targetPath: string): void {
  const safePath = assertInsideRoot(targetPath)
  shell.showItemInFolder(safePath)
}

const DEFAULT_APP_EXTENSIONS = new Set([
  '.docx',
  '.xlsx',
  '.pptx',
  '.doc',
  '.xls',
  '.ppt',
  '.hwp',
  '.hwpx'
])

export async function openInDefaultApp(targetPath: string): Promise<string> {
  const safePath = assertInsideRoot(targetPath)
  if (!DEFAULT_APP_EXTENSIONS.has(extname(safePath).toLowerCase())) {
    shell.showItemInFolder(safePath)
    return ''
  }
  return shell.openPath(safePath)
}

export function forceRemove(targetPath: string): void {
  const safePath = assertInsideRoot(targetPath)
  rmSync(safePath, { recursive: true, force: true })
}
