import { createHash } from 'crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { join, resolve, sep } from 'path'
import { defaultHistoryDir, getHistoryDir, getRootDir, setHistoryDirConfig } from './paths'

const MAX_SNAPSHOTS = 50

function norm(p: string): string {
  return p.replace(/\\/g, '/')
}

function historyRoot(): string {
  return getHistoryDir()
}

function keyOf(filePath: string): string {
  return createHash('sha1').update(norm(filePath)).digest('hex').slice(0, 20)
}

function dirOfFile(filePath: string): string {
  return join(historyRoot(), keyOf(filePath))
}

function listIds(dir: string): number[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^\d+\.md$/.test(f))
    .map((f) => parseInt(f, 10))
    .sort((a, b) => a - b)
}

export function recordSnapshot(filePath: string, content: string, at?: number): void {
  const dir = dirOfFile(filePath)
  mkdirSync(dir, { recursive: true })
  const metaPath = join(dir, 'meta.json')
  if (!existsSync(metaPath)) {
    writeFileSync(metaPath, JSON.stringify({ path: norm(filePath) }), 'utf-8')
  }
  const ids = listIds(dir)
  const last = ids[ids.length - 1]
  if (last !== undefined && readFileSync(join(dir, `${last}.md`), 'utf-8') === content) return
  const id = Math.max(at ?? Date.now(), (last ?? 0) + 1)
  writeFileSync(join(dir, `${id}.md`), content, 'utf-8')
  for (const old of ids.slice(0, Math.max(0, ids.length + 1 - MAX_SNAPSHOTS))) {
    rmSync(join(dir, `${old}.md`), { force: true })
  }
}

export function listSnapshots(filePath: string): { id: number; size: number }[] {
  const dir = dirOfFile(filePath)
  return listIds(dir)
    .reverse()
    .map((id) => ({ id, size: statSync(join(dir, `${id}.md`)).size }))
}

export function readSnapshot(filePath: string, id: number): string {
  if (!Number.isInteger(id)) throw new Error('invalid snapshot id')
  return readFileSync(join(dirOfFile(filePath), `${id}.md`), 'utf-8')
}

export function moveHistory(oldPath: string, newPath: string): void {
  const root = historyRoot()
  if (!existsSync(root)) return
  const from = norm(oldPath)
  const to = norm(newPath)
  for (const name of readdirSync(root)) {
    const metaPath = join(root, name, 'meta.json')
    if (!existsSync(metaPath)) continue
    let meta: { path: string }
    try {
      meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
    } catch {
      continue
    }
    if (meta.path !== from && !meta.path.startsWith(from + '/')) continue
    const nextPath = to + meta.path.slice(from.length)
    const nextDir = join(root, keyOf(nextPath))
    if (existsSync(nextDir)) rmSync(nextDir, { recursive: true, force: true })
    renameSync(join(root, name), nextDir)
    writeFileSync(join(nextDir, 'meta.json'), JSON.stringify({ path: nextPath }), 'utf-8')
  }
}

function isInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent + sep)
}

export function changeHistoryDir(newDir: string | null): string {
  const oldDir = resolve(getHistoryDir())
  const target = resolve(newDir ?? defaultHistoryDir())
  if (target === oldDir) return oldDir

  const rootDir = resolve(getRootDir())
  if (isInside(target, rootDir) || isInside(rootDir, target)) {
    throw new Error('작업 폴더의 하위 폴더나 상위 폴더는 고를 수 없어요.')
  }
  if (isInside(target, oldDir) || isInside(oldDir, target)) {
    throw new Error('현재 기록 폴더의 하위 폴더나 상위 디렉토리는 고를 수 없어요.')
  }

  mkdirSync(target, { recursive: true })
  if (existsSync(oldDir)) {
    for (const name of readdirSync(oldDir)) {
      const from = join(oldDir, name)
      if (!existsSync(join(from, 'meta.json'))) continue
      const to = join(target, name)
      if (existsSync(to)) rmSync(to, { recursive: true, force: true })
      try {
        renameSync(from, to)
      } catch {
        cpSync(from, to, { recursive: true })
        rmSync(from, { recursive: true, force: true })
      }
    }
    try {
      if (readdirSync(oldDir).length === 0) rmSync(oldDir, { recursive: true })
    } catch {}
  }
  setHistoryDirConfig(newDir === null ? null : target)
  return target
}
