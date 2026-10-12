import chokidar, { type FSWatcher } from 'chokidar'
import { renameSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { getRootDir } from './paths'
import { sanitizeTitle, uniqueFileName } from './fileOps'

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

let watcher: FSWatcher | null = null

interface WatcherCallbacks {
  onTreeChanged: () => void
  onFileExternallyChanged: (filePath: string) => void
  onExternalNameSanitized: (oldPath: string, newPath: string) => void
  onFileExternallyRemoved: (filePath: string) => void
}

export function markRemovalByApp(filePath: string): void {
  markSavedByApp(filePath)
}

function sanitizeExternalName(filePath: string): { oldPath: string; newPath: string } | null {
  if (extname(filePath).toLowerCase() !== '.md') return null
  const dir = dirname(filePath)
  const rawTitle = basename(filePath, '.md')
  const cleanTitle = sanitizeTitle(rawTitle)
  if (cleanTitle === rawTitle) return null
  const newName = uniqueFileName(dir, cleanTitle, filePath)
  const newPath = join(dir, newName)
  markSavedByApp(newPath)
  renameSync(filePath, newPath)
  return { oldPath: filePath, newPath }
}

export function startWatcher(callbacks: WatcherCallbacks): void {
  if (watcher) return
  const root = getRootDir()

  watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: (path: string) => /(^|[/\\])\../.test(path.replace(root, ''))
  })

  watcher
    .on('add', (filePath: string) => {
      const sanitized = sanitizeExternalName(filePath)
      if (sanitized) callbacks.onExternalNameSanitized(sanitized.oldPath, sanitized.newPath)
      callbacks.onTreeChanged()
    })
    .on('addDir', () => callbacks.onTreeChanged())
    .on('unlink', (filePath: string) => {
      if (!wasSavedByApp(filePath)) callbacks.onFileExternallyRemoved(filePath)
      callbacks.onTreeChanged()
    })
    .on('unlinkDir', () => callbacks.onTreeChanged())
    .on('change', (filePath: string) => {
      if (!wasSavedByApp(filePath)) {
        callbacks.onFileExternallyChanged(filePath)
      }
    })
}

export function stopWatcher(): void {
  void watcher?.close()
  watcher = null
}
