import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync
} from 'fs'
import { basename, dirname, join, relative, sep } from 'path'
import { assertInsideRoot, getRootDir } from './paths'
import { uniqueEntryName, writeFileAtomic } from './fileOps'
import { popNoteProps, restoreNoteProps, type NoteProps } from './noteProps'

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

interface TrashEntry {
  id: string
  name: string
  from: string
  deletedAt: number
  props: Record<string, NoteProps>
}

const trashDir = (): string => join(getRootDir(), '.markroom', 'trash')
const indexPath = (): string => join(trashDir(), 'index.json')

function loadIndex(): TrashEntry[] {
  try {
    return JSON.parse(readFileSync(indexPath(), 'utf-8')) as TrashEntry[]
  } catch {
    return []
  }
}

function saveIndex(entries: TrashEntry[]): void {
  writeFileAtomic(indexPath(), JSON.stringify(entries, null, 2))
}

function moveAcross(src: string, dest: string): void {
  try {
    renameSync(src, dest)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
    cpSync(src, dest, { recursive: true })
    rmSync(src, { recursive: true, force: true })
  }
}

export function moveToTrash(targetPath: string): string {
  const safe = assertInsideRoot(targetPath)
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const dir = join(trashDir(), id)
  const name = basename(safe)
  mkdirSync(dir, { recursive: true })
  moveAcross(safe, join(dir, name))
  const props = popNoteProps(safe)
  const from = relative(getRootDir(), safe).split(sep).join('/')
  saveIndex([...loadIndex(), { id, name, from, deletedAt: Date.now(), props }])
  return id
}

export function restoreFromTrash(id: string, beforeMove?: (destination: string) => void): string {
  const entries = loadIndex()
  const entry = entries.find((e) => e.id === id)
  const stored = entry ? join(trashDir(), id, entry.name) : ''
  if (!entry || !existsSync(stored)) throw new Error('휴지통에서 찾을 수 없어요.')
  const dir = dirname(join(getRootDir(), ...entry.from.split('/')))
  mkdirSync(dir, { recursive: true })
  const destination = join(dir, uniqueEntryName(dir, entry.name))
  assertInsideRoot(destination)
  beforeMove?.(destination)
  moveAcross(stored, destination)
  restoreNoteProps(destination, entry.props)
  rmSync(join(trashDir(), id), { recursive: true, force: true })
  saveIndex(entries.filter((e) => e.id !== id))
  return destination
}

export function purgeOldTrash(now = Date.now()): void {
  const dir = trashDir()
  if (!existsSync(dir)) return
  const entries = loadIndex()
  const keep = entries.filter((e) => now - e.deletedAt < MAX_AGE_MS)
  const keepIds = new Set(keep.map((e) => e.id))
  for (const name of readdirSync(dir)) {
    if (name === 'index.json' || name.startsWith('.') || keepIds.has(name)) continue
    const path = join(dir, name)
    if (!entries.some((e) => e.id === name) && now - statSync(path).mtimeMs < MAX_AGE_MS) continue
    rmSync(path, { recursive: true, force: true })
  }
  if (keep.length !== entries.length) saveIndex(keep)
}

export function emptyTrash(): void {
  rmSync(trashDir(), { recursive: true, force: true })
}

export function trashFolderPath(): string {
  mkdirSync(trashDir(), { recursive: true })
  return trashDir()
}
