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

let watcher: FSWatcher | null = null
const files = new Set<string>()
const dirs = new Set<string>()
const pending = new Map<string, ReturnType<typeof setTimeout>>()
let treeTimer: ReturnType<typeof setTimeout> | null = null

const isHidden = (root: string, p: string): boolean => /(^|[/\\])\../.test(relative(root, p))

function scan(root: string, dir: string): void {
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
      scan(root, p)
    } else if (e.isFile()) {
      files.add(p)
    }
  }
}

export function startWatcher(callbacks: WatcherCallbacks): void {
  if (watcher) return
  const root = getRootDir()
  files.clear()
  dirs.clear()
  scan(root, root)

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
      treeChanged()
      return
    }
    if (st?.isDirectory()) {
      if (!dirs.has(p)) {
        dirs.add(p)
        scan(root, p)
        treeChanged()
      }
      return
    }
    if (files.delete(p)) {
      if (!wasSavedByApp(p)) callbacks.onFileExternallyRemoved(p)
      treeChanged()
      return
    }
    if (dirs.delete(p)) {
      const prefix = p + sep
      for (const f of [...files]) {
        if (!f.startsWith(prefix)) continue
        files.delete(f)
        if (!wasSavedByApp(f)) callbacks.onFileExternallyRemoved(f)
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
  if (treeTimer) clearTimeout(treeTimer)
  treeTimer = null
}