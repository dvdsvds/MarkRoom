import { existsSync, readFileSync, statSync } from 'fs'
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
  created: '만든 날짜'
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
  // 화면 쪽이 아직 생성 날짜를 모르는 채로 태그를 저장해도 생성 날짜는 지우지 않는다
  const created = data.notes[key]?.created
  if (created && !clean.created) clean.created = created
  if (Object.keys(clean).length === 0) delete data.notes[key]
  else data.notes[key] = clean
  save(data)
}

function dayOf(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** MarkRoom에서 노트를 만들 때 그날을 생성 날짜로 기록한다 */
export function recordCreated(filePath: string, date = new Date()): void {
  const data = load()
  const key = keyOf(filePath)
  data.notes[key] = { ...(data.notes[key] ?? {}), created: dayOf(date) }
  save(data)
}

/**
 * 생성 날짜 기록이 없는 노트에 파일의 생성 시각을 기록한다.
 * 한 번 기록하면 고정해서, 나중에 복사·동기화로 파일 시각이 바뀌어도 흔들리지 않는다.
 */
export function ensureCreatedDates(mdPaths: string[]): void {
  const data = load()
  let changed = false
  for (const filePath of mdPaths) {
    const key = keyOf(filePath)
    if (data.notes[key]?.created) continue
    let time: number
    try {
      const st = statSync(filePath)
      // 생성 시각을 기록하지 않는 파일 시스템이면 0이 나와서 수정 시각을 쓴다
      time = st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs
    } catch {
      continue
    }
    data.notes[key] = { ...(data.notes[key] ?? {}), created: dayOf(new Date(time)) }
    changed = true
  }
  if (changed) save(data)
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
