import { scanTodos } from './todos'
import { app, clipboard, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { existsSync, statSync } from 'fs'
import { mkdir } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import { getHistoryDir, getRootDir } from './paths'
import { buildTree } from './tree'
import {
  readNote,
  renameEntry,
  writeFileAtomic,
  createFolder,
  createEmptyNote,
  moveEntry,
  revealInFolder,
  openInDefaultApp,
  saveAttachment
} from './fileOps'
import { findBacklinks, findBacklinkContexts, updateWikilinksOnRename, buildLinkGraph } from './links'
import { searchNotes, type SearchQuery } from './search'
import {
  getAllNoteProps,
  moveNoteProps,
  setNoteProps,
  type NoteProps
} from './noteProps'
import { emptyTrash, moveToTrash, purgeOldTrash, restoreFromTrash, trashFolderPath } from './trash'
import { markRemovalByApp, markSavedByApp, markMoveByApp, startWatcher } from './watcher'
import { checkExportLinks, exportFolder, listPdfNotes, type ExportOptions } from './exporter'
import { applyRecovery, discardRecovery, findRecoverableFiles } from './recovery'
import {
  changeHistoryDir,
  listSnapshots,
  moveHistory,
  readSnapshot,
  recordSnapshot
} from './history'

interface SaveNoteArgs {
  filePath: string | null
  content: string
}

interface SaveNoteResult {
  filePath: string | null
  renamed: boolean
}

function titleOf(mdPath: string): string {
  return basename(mdPath, extname(mdPath))
}

function saveNote({ filePath, content }: SaveNoteArgs): SaveNoteResult {
  if (!filePath) {
    return { filePath: null, renamed: false }
  }

  markSavedByApp(filePath)
  try {
    if (existsSync(filePath)) {
      const before = readNote(filePath)
      if (before !== content) {
        recordSnapshot(filePath, before, Math.floor(statSync(filePath).mtimeMs))
      }
    }
  } catch {}
  writeFileAtomic(filePath, content)
  return { filePath, renamed: false }
}

const preparedExportDirs = new Set<string>()

export function registerWorkspaceIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('workspace:getRootDir', () => getRootDir())
  ipcMain.handle('workspace:getTree', () => buildTree(getRootDir()))
  ipcMain.handle('workspace:readFile', (_event, filePath: string) => readNote(filePath))
  ipcMain.handle('workspace:saveNote', (_event, args: SaveNoteArgs) => saveNote(args))
  ipcMain.handle('workspace:createFolder', (_event, dirPath: string, name: string) => {
    const target = join(dirPath, name)
    createFolder(target)
    return target
  })
  ipcMain.handle('workspace:createNote', (_event, dirPath: string, title: string) => {
    const target = createEmptyNote(dirPath, title)
    markSavedByApp(target)
    return target
  })
  ipcMain.handle('workspace:renameEntry', (_event, oldPath: string, newName: string) => {
    const target = join(dirname(oldPath), newName)
    const isMarkdown = extname(oldPath).toLowerCase() === '.md'
    markMoveByApp(oldPath)
    markSavedByApp(target)
    renameEntry(oldPath, target)
    moveHistory(oldPath, target)
    moveNoteProps(oldPath, target)
    if (isMarkdown && extname(target).toLowerCase() === '.md') {
      updateWikilinksOnRename(getRootDir(), titleOf(oldPath), titleOf(target), (p, before) => {
        markSavedByApp(p)
        recordSnapshot(p, before)
      })
    }
    return target
  })
  ipcMain.handle('workspace:moveEntry', (_event, sourcePath: string, targetDirPath: string) => {
    markMoveByApp(sourcePath)
    const destination = moveEntry(sourcePath, targetDirPath, markSavedByApp)
    moveHistory(sourcePath, destination)
    moveNoteProps(sourcePath, destination)
    return destination
  })
  ipcMain.handle('workspace:trash', (_event, targetPath: string) => {
    markRemovalByApp(targetPath)
    return moveToTrash(targetPath)
  })
  ipcMain.handle('workspace:restoreTrash', (_event, id: string) =>
    restoreFromTrash(id, markSavedByApp)
  )
  ipcMain.handle('workspace:emptyTrash', () => emptyTrash())
  ipcMain.handle('workspace:openTrash', () => shell.openPath(trashFolderPath()))
  ipcMain.handle('props:getAll', () => getAllNoteProps())
  ipcMain.handle('props:set', (_event, filePath: string, props: NoteProps | null) =>
    setNoteProps(filePath, props)
  )
  ipcMain.handle('workspace:reveal', (_event, targetPath: string) => revealInFolder(targetPath))
  ipcMain.handle('workspace:openInDefaultApp', (_event, targetPath: string) => 
    openInDefaultApp(targetPath)
  )
  ipcMain.handle('workspace:copyPath', (_event, targetPath: string, relative: boolean) => {
    const text = relative ? targetPath.slice(getRootDir().length + 1) : targetPath
    clipboard.writeText(text)
  })
  ipcMain.handle('workspace:findBacklinks', (_event, mdPath: string) =>
    findBacklinks(getRootDir(), titleOf(mdPath), mdPath)
  )
  ipcMain.handle('workspace:linkGraph', () => buildLinkGraph(getRootDir()))
  ipcMain.handle('workspace:findBacklinkContexts', (_event, mdPath: string) =>
    findBacklinkContexts(getRootDir(), titleOf(mdPath), mdPath)
  )
  ipcMain.handle(
    'workspace:saveAttachment',
    (_event, noteDirPath: string, kind: 'img' | 'files', fileName: string, data: ArrayBuffer) =>
      saveAttachment(noteDirPath, kind, fileName, Buffer.from(data))
  )
  ipcMain.handle('workspace:search', (_event, query: SearchQuery) =>
    searchNotes(getRootDir(), query)
  )
  ipcMain.handle('workspace:pickExportDestination', async () => {
    const window = getWindow()
    const options = {
      defaultPath: app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
  ipcMain.handle('workspace:hasRootMainNote', () => existsSync(join(getRootDir(), 'main.md')))
  ipcMain.handle('workspace:checkExportLinks', (_event, folderPath: string) =>
    checkExportLinks(getRootDir(), folderPath)
  )
  ipcMain.handle('workspace:exportFolder', async (_event, opts: ExportOptions) => {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), 120000)
    })
    try {
      return await Promise.race([exportFolder(getRootDir(), opts), timeout])
    } finally {
      clearTimeout(timer)
    }
  })
  ipcMain.handle('workspace:listPdfNotes', (_event, folderPath: string) =>
    listPdfNotes(getRootDir(), folderPath)
  )
  ipcMain.handle('workspace:openPath', async (_event, targetPath: string) => {
    if (!preparedExportDirs.has(targetPath)) return '허용되지 않은 경로예요.'
    return shell.openPath(targetPath)
  })
  ipcMain.handle(
    'workspace:prepareExport',
    async (_event, parentDir: string, name: string, md: boolean, pdf: boolean) => {
      const clean = String(name).trim()
      if (!clean || clean === '.' || clean === '..' || /[\\/:*?"<>|]/.test(clean)) {
        return { ok: false as const, error: 'invalid' as const }
      }
      const baseDir = join(parentDir, clean)
      if (existsSync(baseDir)) return { ok: false as const, error: 'exists' as const }
      const mdDir = md ? join(baseDir, 'export-md') : null
      const pdfDir = pdf ? join(baseDir, 'export-pdf') : null
      const work = (async (): Promise<void> => {
        for (const d of [mdDir, pdfDir]) if (d) await mkdir(d, { recursive: true })
      })()
      const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 5000))
      try {
        const r = await Promise.race([work.then(() => 'ok' as const), timeout])
        if (r === 'timeout') return { ok: false as const, error: 'denied' as const }
      } catch {
        return { ok: false as const, error: 'denied' as const }
      }
      preparedExportDirs.add(baseDir)
      return { ok: true as const, baseDir, mdDir, pdfDir }
    }
  )
  ipcMain.handle('workspace:listRecoverable', () => findRecoverableFiles(getRootDir()))
  ipcMain.handle('workspace:applyRecovery', (_event, tmpPath: string, targetPath: string) => {
    markSavedByApp(targetPath)
    applyRecovery(tmpPath, targetPath)
  })
  ipcMain.handle('workspace:discardRecovery', (_event, tmpPath: string) => discardRecovery(tmpPath))
  ipcMain.handle('workspace:listHistory', (_event, filePath: string) => listSnapshots(filePath))
  ipcMain.handle('workspace:scanTodos', (_e, overrides?: Record<string, string>) =>
    scanTodos(getRootDir(), overrides)
  )
  ipcMain.handle('workspace:readHistory', (_event, filePath: string, id: number) =>
    readSnapshot(filePath, id)
  )
  ipcMain.handle('workspace:getHistoryDir', () => getHistoryDir())
  ipcMain.handle('workspace:pickFolder', async (_event, defaultPath?: string) => {
    const window = getWindow()
    const options = {
      defaultPath: defaultPath ?? getHistoryDir(),
      properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
  ipcMain.handle('workspace:setHistoryDir', (_event, dir: string | null) => {
    try {
      return { ok: true as const, path: changeHistoryDir(dir) }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })
  purgeOldTrash()
  startWatcher({
    onTreeChanged: () => {
      getWindow()?.webContents.send('workspace:tree-changed', buildTree(getRootDir()))
    },
    onFileExternallyChanged: (filePath: string) => {
      getWindow()?.webContents.send('workspace:file-changed', filePath)
    },
    onExternalNameSanitized: (oldPath: string, newPath: string) => {
      getWindow()?.webContents.send('workspace:external-name-sanitized', oldPath, newPath)
    },
    onFileExternallyMoved: (oldPath: string, newPath: string) => {
      moveNoteProps(oldPath, newPath)
    },
    onFileExternallyRemoved: (filePath: string) => {
      getWindow()?.webContents.send('workspace:file-externally-removed', filePath)
    }
  })
}
