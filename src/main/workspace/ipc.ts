import { scanTodos } from './todos'
import { clipboard, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { existsSync, statSync } from 'fs'
import { basename, dirname, extname, join } from 'path'
import { getHistoryDir, getRootDir } from './paths'
import { buildTree } from './tree'
import {
  isEmptyNote,
  readNote,
  renameEntry,
  trashEntry,
  writeFileAtomic,
  createFolder,
  createEmptyNote,
  moveEntry,
  revealInFolder,
  saveAttachment,
} from './fileOps'
import { findBacklinks, findBacklinkContexts, updateWikilinksOnRename } from './links'
import { searchNotes, type SearchQuery } from './search'
import { markRemovalByApp, markSavedByApp, startWatcher } from './watcher'
import { checkExportLinks, exportFolder, type ExportOptions } from './exporter'
import { applyRecovery, discardRecovery, findRecoverableFiles } from './recovery'
import { changeHistoryDir, listSnapshots, moveHistory, readSnapshot, recordSnapshot } from './history'

interface SaveNoteArgs {
  filePath: string | null
  dirPath: string
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
  if (isEmptyNote(content)) {
    return { filePath: null, renamed: false }
  }

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
  } catch {
  }
  writeFileAtomic(filePath, content)
  return { filePath, renamed: false }
}

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
    markRemovalByApp(oldPath)
    renameEntry(oldPath, target)
    moveHistory(oldPath, target)
    if (isMarkdown && extname(target).toLowerCase() === '.md') {
      updateWikilinksOnRename(getRootDir(), titleOf(oldPath), titleOf(target))
    }
    return target
  })
  ipcMain.handle('workspace:moveEntry', (_event, sourcePath: string, targetDirPath: string) => {
    markRemovalByApp(sourcePath)
    const destination = moveEntry(sourcePath, targetDirPath, markSavedByApp)
    moveHistory(sourcePath, destination)
    return destination
  })
  ipcMain.handle('workspace:trash', (_event, targetPath: string) => {
    markRemovalByApp(targetPath)
    return trashEntry(targetPath)
  })
  ipcMain.handle('workspace:reveal', (_event, targetPath: string) => revealInFolder(targetPath))
  ipcMain.handle('workspace:copyPath', (_event, targetPath: string, relative: boolean) => {
    const text = relative ? targetPath.slice(getRootDir().length + 1) : targetPath
    clipboard.writeText(text)
  })
  ipcMain.handle('workspace:findBacklinks', (_event, mdPath: string) =>
    findBacklinks(getRootDir(), titleOf(mdPath), mdPath)
  )
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
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
  ipcMain.handle('workspace:hasRootMainNote', () => existsSync(join(getRootDir(), 'main.md')))
  ipcMain.handle('workspace:checkExportLinks', (_event, folderPath: string) =>
    checkExportLinks(getRootDir(), folderPath)
  )
  ipcMain.handle('workspace:exportFolder', (_event, opts: ExportOptions) => {
    const result = exportFolder(getRootDir(), opts)
    void shell.openPath(opts.destDir)
    return result
  })
  ipcMain.handle('workspace:listRecoverable', () => findRecoverableFiles(getRootDir()))
  ipcMain.handle('workspace:applyRecovery', (_event, tmpPath: string, targetPath: string) => {
    markSavedByApp(targetPath)
    applyRecovery(tmpPath, targetPath)
  })
  ipcMain.handle('workspace:discardRecovery', (_event, tmpPath: string) => discardRecovery(tmpPath))
  ipcMain.handle('workspace:listHistory', (_event, filePath: string) => listSnapshots(filePath))
  ipcMain.handle('workspace:scanTodos', (_e, overrides?: Record<string, string>) => 
    scanTodos(getRootDir(), overrides))
  ipcMain.handle('workspace:readHistory', (_event, filePath: string, id: number) =>
    readSnapshot(filePath, id)
  )
  ipcMain.handle('workspace:getHistoryDir', () => getHistoryDir())
  ipcMain.handle('workspace:pickFolder', async () => {
    const window = getWindow()
    const options = {
      defaultPath: getHistoryDir(),
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
    onFileExternallyRemoved: (filePath: string) => {
      getWindow()?.webContents.send('workspace:file-externally-removed', filePath)
    }
  })
}
