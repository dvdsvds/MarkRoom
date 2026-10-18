import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { TreeNode } from '../main/workspace/tree'
import { openInDefaultApp } from '../main/workspace/fileOps'

interface SaveNoteArgs {
  filePath: string | null
  content: string
}

interface SaveNoteResult {
  filePath: string | null
  renamed: boolean
}

interface Backlink {
  path: string
  count: number
}

interface LinkGraph {
  nodes: { path: string; title: string }[]
  edges: { source: string; target: string }[]
}

interface BacklinkWithContext {
  path: string
  count: number
  contexts: { line: number; text: string }[]
}

interface SearchQuery {
  text: string
  folder: string | null
}

interface SearchResult {
  path: string
  title: string
  snippet: string | null
}

interface BrokenLink {
  fromPath: string
  title: string
  reason: 'missing' | 'outside'
}

interface ExportOptions {
  folderPath: string
  destDir: string
  isRoot: boolean
  representativeName: 'README' | 'index' | 'main' | null
}

interface ExportResult {
  exportedFiles: number
  images: number
  attachments: number
}

interface PdfNote {
  relPath: string
  source: string
  baseDir: string
  links: Record<string, string | null>
}

type PrepareResult =
  | { ok: true; baseDir: string; mdDir: string | null; pdfDir: string | null }
  | { ok: false; error: 'invalid' | 'exists' | 'denied' }

interface RecoverableItem {
  tmpPath: string
  targetPath: string
  tmpContent: string
  currentContent: string | null
}

interface HistoryEntry {
  id: number
  size: number
}

const api = {
  app: {
    getChangelog: (): Promise<string | null> => ipcRenderer.invoke('app:getChangelog')
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggleMaximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    confirmClose: (): Promise<void> => ipcRenderer.invoke('window:confirmClose'),
    onCloseRequested: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('window:close-requested', listener)
      return () => ipcRenderer.removeListener('window:close-requested', listener)
    },
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    platform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('window:platform'),
    onMaximizedChanged: (callback: (isMaximized: boolean) => void): (() => void) => {
      const listener = (_event: unknown, isMaximized: boolean): void => callback(isMaximized)
      ipcRenderer.on('window:maximized-changed', listener)
      return () => ipcRenderer.removeListener('window:maximized-changed', listener)
    }
  },
  quick: {
    submit: (text: string): Promise<void> => ipcRenderer.invoke('quick:submit', text),
    hide: (): Promise<void> => ipcRenderer.invoke('quick:hide'),
    onShown: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('quick:shown', listener)
      return () => ipcRenderer.removeListener('quick:shown', listener)
    }
  },
  export: {
    pdf: (payload: {
      title: string
      html: string
      css: string
    }): Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('export:pdf', payload),
    pdfFile: (payload: {
      html: string
      css: string
      pdfDir: string
      relPath: string
    }): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('export:pdfFile', payload)
  },
  props: {
    getAll: (): Promise<Record<string, Record<string, string>>> =>
      ipcRenderer.invoke('props:getAll'),
    set: (filePath: string, props: Record<string, string> | null): Promise<void> =>
      ipcRenderer.invoke('props:set', filePath, props)
  },
  code: {
    readFiles: (
      code: string,
      baseDir: string,
      lang: 'js' | 'py' = 'py'
    ): Promise<{ files: Record<string, string>; fileErrors: Record<string, string> }> =>
      ipcRenderer.invoke('code:readFiles', code, baseDir, lang)
  },
  workspace: {
    getRootDir: (): Promise<string> => ipcRenderer.invoke('workspace:getRootDir'),
    getTree: (): Promise<TreeNode[]> => ipcRenderer.invoke('workspace:getTree'),
    readFile: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:readFile', filePath),
    saveNote: (args: SaveNoteArgs): Promise<SaveNoteResult> =>
      ipcRenderer.invoke('workspace:saveNote', args),
    createFolder: (dirPath: string, name: string): Promise<string> =>
      ipcRenderer.invoke('workspace:createFolder', dirPath, name),
    createNote: (dirPath: string, title: string): Promise<string> =>
      ipcRenderer.invoke('workspace:createNote', dirPath, title),
    renameEntry: (oldPath: string, newName: string): Promise<string> =>
      ipcRenderer.invoke('workspace:renameEntry', oldPath, newName),
    moveEntry: (sourcePath: string, targetDirPath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:moveEntry', sourcePath, targetDirPath),
    trash: (targetPath: string): Promise<void> => ipcRenderer.invoke('workspace:trash', targetPath),
    reveal: (targetPath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:reveal', targetPath),
    openInDefaultApp: (targetPath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:openInDefaultApp', targetPath),
    copyPath: (targetPath: string, relative: boolean): Promise<void> =>
      ipcRenderer.invoke('workspace:copyPath', targetPath, relative),
    findBacklinks: (mdPath: string): Promise<Backlink[]> =>
      ipcRenderer.invoke('workspace:findBacklinks', mdPath),
    findBacklinkContexts: (mdPath: string): Promise<BacklinkWithContext[]> =>
      ipcRenderer.invoke('workspace:findBacklinkContexts', mdPath),
    linkGraph: (): Promise<LinkGraph> => ipcRenderer.invoke('workspace:linkGraph'),
    saveAttachment: (
      noteDirPath: string,
      kind: 'img' | 'files',
      fileName: string,
      data: ArrayBuffer
    ): Promise<string> =>
      ipcRenderer.invoke('workspace:saveAttachment', noteDirPath, kind, fileName, data),
    search: (query: SearchQuery): Promise<SearchResult[]> =>
      ipcRenderer.invoke('workspace:search', query),
    pickExportDestination: (): Promise<string | null> =>
      ipcRenderer.invoke('workspace:pickExportDestination'),
    hasRootMainNote: (): Promise<boolean> => ipcRenderer.invoke('workspace:hasRootMainNote'),
    checkExportLinks: (folderPath: string): Promise<BrokenLink[]> =>
      ipcRenderer.invoke('workspace:checkExportLinks', folderPath),
    exportFolder: (opts: ExportOptions): Promise<ExportResult> =>
      ipcRenderer.invoke('workspace:exportFolder', opts),
    listPdfNotes: (folderPath: string): Promise<PdfNote[]> =>
      ipcRenderer.invoke('workspace:listPdfNotes', folderPath),
    openPath: (targetPath: string): Promise<string> =>
      ipcRenderer.invoke('workspace:openPath', targetPath),
    prepareExport: (
      parentDir: string,
      name: string,
      md: boolean,
      pdf: boolean
    ): Promise<PrepareResult> =>
      ipcRenderer.invoke('workspace:prepareExport', parentDir, name, md, pdf),
    listRecoverable: (): Promise<RecoverableItem[]> =>
      ipcRenderer.invoke('workspace:listRecoverable'),
    applyRecovery: (tmpPath: string, targetPath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:applyRecovery', tmpPath, targetPath),
    discardRecovery: (tmpPath: string): Promise<void> =>
      ipcRenderer.invoke('workspace:discardRecovery', tmpPath),
    listHistory: (filePath: string): Promise<HistoryEntry[]> =>
      ipcRenderer.invoke('workspace:listHistory', filePath),
    readHistory: (filePath: string, id: number): Promise<string> =>
      ipcRenderer.invoke('workspace:readHistory', filePath, id),
    scanTodos: (
      overrides?: Record<string, string>
    ): Promise<{ path: string; line: number; text: string; done: boolean }[]> =>
      ipcRenderer.invoke('workspace:scanTodos', overrides),
    getHistoryDir: (): Promise<string> => ipcRenderer.invoke('workspace:getHistoryDir'),
    pickFolder: (defaultPath?: string): Promise<string | null> =>
      ipcRenderer.invoke('workspace:pickFolder', defaultPath),
    setHistoryDir: (
      dir: string | null
    ): Promise<{ ok: true; path: string } | { ok: false; error: string }> =>
      ipcRenderer.invoke('workspace:setHistoryDir', dir),
    onTreeChanged: (callback: (tree: TreeNode[]) => void): (() => void) => {
      const listener = (_event: unknown, tree: TreeNode[]): void => callback(tree)
      ipcRenderer.on('workspace:tree-changed', listener)
      return () => ipcRenderer.removeListener('workspace:tree-changed', listener)
    },
    onFileChanged: (callback: (filePath: string) => void): (() => void) => {
      const listener = (_event: unknown, filePath: string): void => callback(filePath)
      ipcRenderer.on('workspace:file-changed', listener)
      return () => ipcRenderer.removeListener('workspace:file-changed', listener)
    },
    onExternalNameSanitized: (
      callback: (oldPath: string, newPath: string) => void
    ): (() => void) => {
      const listener = (_event: unknown, oldPath: string, newPath: string): void =>
        callback(oldPath, newPath)
      ipcRenderer.on('workspace:external-name-sanitized', listener)
      return () => ipcRenderer.removeListener('workspace:external-name-sanitized', listener)
    },
    onFileExternallyRemoved: (callback: (filePath: string) => void): (() => void) => {
      const listener = (_event: unknown, filePath: string): void => callback(filePath)
      ipcRenderer.on('workspace:file-externally-removed', listener)
      return () => ipcRenderer.removeListener('workspace:file-externally-removed', listener)
    }
  }
}

export type MarkRoomApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
