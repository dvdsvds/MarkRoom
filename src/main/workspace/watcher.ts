import chokidar, { type FSWatcher } from 'chokidar'
import { renameSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { getRootDir } from './paths'
import { sanitizeTitle, uniqueFileName } from './fileOps'

/**
 * 앱이 방금 자기가 쓴 파일은 파일 감시 이벤트에서 "외부 변경"으로
 * 취급하지 않기 위한 표시. writeFileAtomic 직후 짧은 시간만 등록해 둔다.
 * (기획 문서 14장에서 구현 단계에 정하기로 한 부분)
 */
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
  /** 앱 밖에서 금지 문자가 든 이름으로 바뀐 .md 파일을 안전한 이름으로 고쳤을 때 (기획 문서 3장). */
  onExternalNameSanitized: (oldPath: string, newPath: string) => void
  /** 앱 안에서 한 삭제·이름 변경·이동이 아닌, 정말 앱 밖에서 파일이 사라졌을 때
   * (기획 문서 8장 "앱 밖에서 이동·이름 변경 ... 되거나 삭제된 메모의 탭"). */
  onFileExternallyRemoved: (filePath: string) => void
}

/** ipc.ts가 앱 스스로 지우거나 이름을 바꾸는 경로를 미리 등록해 두면, 그
 * unlink 이벤트는 "앱 밖에서 사라짐"으로 취급하지 않는다. */
export function markRemovalByApp(filePath: string): void {
  markSavedByApp(filePath)
}

/**
 * 앱 밖에서 파일 이름에 금지 문자(`/ \ : ? *` 등)가 들어간 .md로 바뀌면
 * 안전한 이름으로 고쳐 쓴다 (기획 문서 3장 "앱 밖에서 고친 제목에 금지
 * 문자가 있으면 ... 안전한 문자로 변환하고 경고도 표시"). 고친 뒤 파일
 * 이름에는 더 이상 금지 문자가 없으므로 재귀적으로 다시 걸리지 않는다.
 */
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
