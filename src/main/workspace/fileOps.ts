import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { shell } from 'electron'
import { assertInsideRoot } from './paths'

const FORBIDDEN_FILENAME_CHARS = /[/\\:?*"<>|]/g

export function sanitizeTitle(rawTitle: string): string {
  const cleaned = rawTitle.replace(FORBIDDEN_FILENAME_CHARS, ' ').trim().replace(/\s+/g, '_')
  return cleaned.length > 0 ? cleaned : '제목_없음'
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
  renameSync(safeOld, safeNew)
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

export function forceRemove(targetPath: string): void {
  const safePath = assertInsideRoot(targetPath)
  rmSync(safePath, { recursive: true, force: true })
}
