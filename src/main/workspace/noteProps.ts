import { existsSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import { getRootDir } from './paths'
import { writeFileAtomic } from './fileOps'

export type NoteProps = Record<string, string>

interface PropsFile {
  version: 1
  notes: Record<string, NoteProps>
}

const FRONT_MATTER_KEYS: Record<string, string> = {
  status: '상태',
  substatus: '세부',
  priority: '중요도',
}

let cache: { root: string; data: PropsFile } | null = null

function storePath(root: string): string {
  return join(root, '.markroom', 'properties.json')
}

function load(): PropsFile {
  const root = getRootDir()
  if (cache?.root === root) return cache.data
  let data: PropsFile = { version: 1, notes: {} }
  try {
    if (existsSync(storePath(root))) {
      const parsed = JSON.parse(readFileSync(storePath(root), 'utf-8')) as Partial<PropsFile>
      if (parsed.notes && typeof parsed.notes === 'object')
        data = { version: 1, notes: parsed.notes }
    }
  } catch {
    data = { version: 1, notes: {} }
  }
  cache = { root, data }
  return data
}

function save(data: PropsFile): void {
  writeFileAtomic(storePath(getRootDir()), JSON.stringify(data, null, 2))
}

function keyOf(filePath: string): string {
  return relative(getRootDir(), filePath).split(sep).join('/')
}

export function getAllNoteProps(): Record<string, NoteProps> {
  const root = getRootDir()
  const out: Record<string, NoteProps> = {}
  for (const [key, props] of Object.entries(load().notes)) {
    out[join(root, ...key.split('/'))] = props
  }
  return out
}

export function getNoteProps(filePath: string): NoteProps | null {
  return load().notes[keyOf(filePath)] ?? null
}

export function setNoteProps(filePath: string, props: NoteProps | null): void {
  const data = load()
  const key = keyOf(filePath)
  const clean = Object.fromEntries(Object.entries(props ?? {}).filter(([, v]) => v))
  if (Object.keys(clean).length === 0) delete data.notes[key]
  else data.notes[key] = clean
  save(data)
}

export function moveNoteProps(oldPath: string, newPath: string): void {
  const data = load()
  const oldKey = keyOf(oldPath)
  const newKey = keyOf(newPath)
  let changed = false
  for (const key of Object.keys(data.notes)) {
    if (key !== oldKey && !key.startsWith(`${oldKey}/`)) continue
    data.notes[newKey + key.slice(oldKey.length)] = data.notes[key]
    delete data.notes[key]
    changed = true
  }
  if (changed) save(data)
}

export function popNoteProps(targetPath: string): Record<string, NoteProps> {
  const data = load()
  const target = keyOf(targetPath)
  const out: Record<string, NoteProps> = {}
  for (const key of Object.keys(data.notes)) {
    if (key !== target && !key.startsWith(`${target}/`)) continue
    out[key.slice(target.length)] = data.notes[key]
    delete data.notes[key]
  }
  if (Object.keys(out).length > 0) save(data)
  return out
}

export function restoreNoteProps(targetPath: string, props: Record<string, NoteProps>): void {
  const entries = Object.entries(props)
  if (entries.length === 0) return
  const data = load()
  const target = keyOf(targetPath)
  for (const [suffix, noteProps] of entries) data.notes[target + suffix] = noteProps
  save(data)
}

export function removeNoteProps(targetPath: string): void {
  const data = load()
  const target = keyOf(targetPath)
  let changed = false
  for (const key of Object.keys(data.notes)) {
    if (key !== target && !key.startsWith(`${target}/`)) continue
    delete data.notes[key]
    changed = true
  }
  if (changed) save(data)
}

function yamlValue(value: string): string {
  return /^[\p{L}\p{N}][\p{L}\p{N} _./-]*$/u.test(value) ? value : JSON.stringify(value)
}

export function frontMatterFor(filePath: string): string {
  const props = getNoteProps(filePath)
  if (!props) return ''
  const lines = Object.entries(FRONT_MATTER_KEYS)
    .filter(([key]) => props[key])
    .map(([key, label]) => `${label}: ${yamlValue(props[key])}`)
  return lines.length > 0 ? `---\n${lines.join('\n')}\n---\n\n` : ''
}
