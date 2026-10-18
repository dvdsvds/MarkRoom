import { readdirSync, renameSync, statSync, watch, type FSWatcher, type Stats } from 'fs'
import { basename, dirname, extname, join, relative, sep } from 'path'
import { getRootDir } from './paths'
import { sanitizeFileName, uniqueFileName } from './fileOps'
import { invalidateNote } from './noteCache'

const recentlySavedByApp = new Map<string, ReturnType<typeof setTimeout>>()

export function markSavedByApp(filePath: string): void {
  const existing = recentlySavedByApp.get(filePath)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => recentlySavedByApp.delete(filePath), 1000)
  recentlySavedByApp.set(filePath, timer)
}

function wasSavedByApp(filePath: string): boolean {
  return recentlySavedByApp.has(filePath)
}

interface WatcherCallbacks {
  onTreeChanged: () => void
  onFileExternallyMoved: (oldPath: string, newPath: string) => void
  onFileExternallyChanged: (filePath: string) => void
  onExternalNameSanitized: (oldPath: string, newPath: string) => void
  onFileExternallyRemoved: (filePath: string) => void
}

export function markRemovalByApp(filePath: string): void {
  markSavedByApp(filePath)
}

export function markMoveByApp(path: string): void {
  markSavedByApp(path)
  const prefix = path + sep
  for (const f of files) if (f.startsWith(prefix)) markSavedByApp(f)
}

function sanitizeExternalName(filePath: string): { oldPath: string; newPath: string } | null {
  if (extname(filePath).toLowerCase() !== '.md') return null
  const dir = dirname(filePath)
  const rawTitle = basename(filePath, '.md')
  const cleanTitle = sanitizeFileName(rawTitle)
  if (cleanTitle === rawTitle) return null
  const newName = uniqueFileName(dir, cleanTitle, filePath)
  const newPath = join(dir, newName)
  markSavedByApp(newPath)
  renameSync(filePath, newPath)
  return { oldPath: filePath, newPath }
}

interface FileStat {
  size: number
  mtimeMs: number
}

interface PendingMove {
  path: string
  stat: FileStat
  timer: ReturnType<typeof setTimeout>
}

const PAIR_WINDOW_MS = 1000

let watcher: FSWatcher | null = null
const fileStats = new Map<string, FileStat>()
const goneFiles = new Map<string, PendingMove>()
const appearedFiles = new Map<string, PendingMove>()
const files = new Set<string>()
const dirs = new Set<string>()
const pending = new Map<string, ReturnType<typeof setTimeout>>()
let treeTimer: ReturnType<typeof setTimeout> | null = null

const isHidden = (root: string, p: string): boolean => /(^|[/\\])\../.test(relative(root, p))

const statOf = (st: Stats): FileStat => ({ size: st.size, mtimeMs: st.mtimeMs })

function sameFile(aPath: string, a: FileStat, bPath: string, b: FileStat): boolean {
  return (
    a.size === b.size &&
    a.mtimeMs === b.mtimeMs &&
    extname(aPath).toLowerCase() === extname(bPath).toLowerCase()
  )
}

function pickCounterpart(
  pool: Map<string, PendingMove>,
  path: string,
  stat: FileStat
): PendingMove | null {
  const matches = [...pool.values()].filter(
    (m) => m.path !== path && sameFile(m.path, m.stat, path, stat)
  )
  if (matches.length === 1) return matches[0]
  const sameName = matches.filter((m) => basename(m.path) === basename(path))
  return sameName.length === 1 ? sameName[0] : null
}

function park(pool: Map<string, PendingMove>, path: string, stat: FileStat): void {
  const timer = setTimeout(() => pool.delete(path), PAIR_WINDOW_MS)
  pool.set(path, { path, stat, timer })
}

function claim(pool: Map<string, PendingMove>, match: PendingMove): void {
  clearTimeout(match.timer)
  pool.delete(match.path)
}

function clearPairing(): void {
  for (const pool of [goneFiles, appearedFiles]) {
    for (const m of pool.values()) clearTimeout(m.timer)
    pool.clear()
  }
  fileStats.clear()
}

function scan(root: string, dir: string, added?: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (isHidden(root, p)) continue
    if (e.isDirectory()) {
      dirs.add(p)
      scan(root, p, added)
    } else if (e.isFile()) {
      files.add(p)
      added?.push(p)
      try {
        fileStats.set(p, statOf(statSync(p)))
      } catch {

      }
    }
  }
}

export function startWatcher(callbacks: WatcherCallbacks): void {
  if (watcher) return
  const root = getRootDir()
  files.clear()
  dirs.clear()
  clearPairing()
  scan(root, root)

  const fileGone = (p: string): void => {
    const stat = fileStats.get(p)
    fileStats.delete(p)
    if (!stat) return
    const match = pickCounterpart(appearedFiles, p, stat)
    if (match) {
      claim(appearedFiles, match)
      callbacks.onFileExternallyMoved(p, match.path)
    } else {
      park(goneFiles, p, stat)
    }
  }

  const fileAppeared = (p: string, stat: FileStat): void => {
    fileStats.set(p, stat)
    const match = pickCounterpart(goneFiles, p, stat)
    if (match) {
      claim(goneFiles, match)
      callbacks.onFileExternallyMoved(match.path, p)
    } else {
      park(appearedFiles, p, stat)
    }
  }

  const treeChanged = (): void => {
    if (treeTimer) clearTimeout(treeTimer)
    treeTimer = setTimeout(() => {
      treeTimer = null
      callbacks.onTreeChanged()
    }, 100)
  }

  const handle = (p: string): void => {
    invalidateNote(p)
    let st: Stats | null = null
    try {
      st = statSync(p)
    } catch {
      st = null
    }
    if (st?.isFile()) {
      if (files.has(p)) {
        fileStats.set(p, statOf(st))
        if (!wasSavedByApp(p)) callbacks.onFileExternallyChanged(p)
        return
      }
      files.add(p)
      const sanitized = wasSavedByApp(p) ? null : sanitizeExternalName(p)
      if (sanitized) {
        files.delete(sanitized.oldPath)
        files.add(sanitized.newPath)
        callbacks.onExternalNameSanitized(sanitized.oldPath, sanitized.newPath)
      }
      if (wasSavedByApp(p)) fileStats.set(p, statOf(st))
      else fileAppeared(sanitized?.newPath ?? p, statOf(st))
      treeChanged()
      return
    }
    if (st?.isDirectory()) {
      if (!dirs.has(p)) {
        dirs.add(p)
        const added: string[] = []
        scan(root, p, added)
        for (const f of added) {
          const stat = fileStats.get(f)
          if (stat && !wasSavedByApp(f)) fileAppeared(f, stat)
        }
        treeChanged()
      }
      return
    }
    if (files.delete(p)) {
      if (wasSavedByApp(p)) {
        fileStats.delete(p)
      } else {
        callbacks.onFileExternallyRemoved(p)
        fileGone(p)
      }
      treeChanged()
      return
    }
    if (dirs.delete(p)) {
      const prefix = p + sep
      for (const f of [...files]) {
        if (wasSavedByApp(f)) {
          fileStats.delete(f)
        } else {
          callbacks.onFileExternallyRemoved(f)
          fileGone(f)
        }
      }
      for (const d of [...dirs]) if (d.startsWith(prefix)) dirs.delete(d)
      treeChanged()
    }
  }

  watcher = watch(root, { recursive: true }, (_event, name) => {
    if (!name) {
      files.clear()
      dirs.clear()
      scan(root, root)
      treeChanged()
      return
    }
    const p = join(root, name.toString())
    if (isHidden(root, p)) return
    const t = pending.get(p)
    if (t) clearTimeout(t)
    pending.set(
      p,
      setTimeout(() => {
        pending.delete(p)
        handle(p)
      }, 50)
    )
  })
  watcher.on('error', () => stopWatcher())
}

export function stopWatcher(): void {
  watcher?.close()
  watcher = null
  for (const t of pending.values()) clearTimeout(t)
  pending.clear()
  clearPairing()
  if (treeTimer) clearTimeout(treeTimer)
  treeTimer = null
}