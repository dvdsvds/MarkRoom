import { ElectronAPI } from '@electron-toolkit/preload'

export interface TreeNode {
  name: string
  path: string
  type: 'folder' | 'file'
  children?: TreeNode[]
}

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
  edges: { source: string; target: string}[]
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
}

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

export interface MarkRoomApi {
  app: {
    getChangelog: () => Promise<string | null>
  }
  window: {
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
    confirmClose: () => Promise<void>
    onCloseRequested: (callback: () => void) => () => void
    isMaximized: () => Promise<boolean>
    platform: () => Promise<NodeJS.Platform>
    onMaximizedChanged: (callback: (isMaximized: boolean) => void) => () => void
  }
  quick: {
    submit: (text: string) => Promise<void>
    hide: () => Promise<void>
    onShown: (callback: () => void) => () => void
  }
  export: {
    pdf: (payload: {
      title: string
      html: string
      css: string
    }) => Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }>
    pdfFile: (payload: {
      html: string
      css: string
      pdfDir: string
      relPath: string
    }) => Promise<{ ok: boolean; error?: string }>
  },
  props: {
    getAll: () => Promise<Record<string, Record<string, string>>>
    set: (filePath: string, props: Record<string, string> | null) => Promise<void>
  },
  code: {
    readFiles: (
      code: string,
      baseDir: string,
      lagn?: 'js' | 'py'
    ) => Promise<{ files: Record<string, string>; fileErrors: Record<string, string> }>
  }
  workspace: {
    getRootDir: () => Promise<string>
    getTree: () => Promise<TreeNode[]>
    readFile: (filePath: string) => Promise<string>
    readTextFile: (
      filePath: string
    ) => Promise<{ ok: true; content: string } | { ok: false; reason: 'binary' | 'tooLarge' }>
    saveNote: (args: SaveNoteArgs) => Promise<SaveNoteResult>
    createFolder: (dirPath: string, name: string) => Promise<string>
    createNote: (dirPath: string, name: string) => Promise<string>
    renameEntry: (oldPath: string, newName: string) => Promise<string>
    moveEntry: (sourcePath: string, targetDirPath: string) => Promise<string>
    trash: (targetPath: string) => Promise<string>
    restoreTrash: (id: string) => Promise<string>
    emptyTrash: () => Promise<void>
    openTrash: () => Promise<string>
    reveal: (targetPath: string) => Promise<void>
    openInDefaultApp: (targetPath: string) => Promise<string>
    copyPath: (targetPath: string, relative: boolean) => Promise<void>
    findBacklinks: (mdPath: string) => Promise<Backlink[]>
    findBacklinkContexts: (mdPath: string) => Promise<BacklinkWithContext[]>
    linkGraph: () => Promise<LinkGraph>
    saveAttachment: (
      noteDirPath: string,
      kind: 'img' | 'files',
      fileName: string,
      data: ArrayBuffer
    ) => Promise<string>
    search: (query: SearchQuery) => Promise<SearchResult[]>
    pickExportDestination: () => Promise<string | null>
    hasRootMainNote: () => Promise<boolean>
    checkExportLinks: (folderPath: string) => Promise<BrokenLink[]>
    exportFolder: (opts: ExportOptions) => Promise<ExportResult>
    listPdfNotes: (folderPath: string) => Promise<PdfNote[]>
    openPath: (targetPath: string) => Promise<string>
    prepareExport: (
      parentDir: string,
      name: string,
      md: boolean,
      pdf: boolean
    ) => Promise<PrepareResult>
    listRecoverable: () => Promise<RecoverableItem[]>
    applyRecovery: (tmpPath: string, targetPath: string) => Promise<void>
    discardRecovery: (tmpPath: string) => Promise<void>
    listHistory: (filePath: string) => Promise<HistoryEntry[]>
    scanTodos: (
      overrides?: Record<string, string>
    ) => Promise<{ path: string; line: number; text: string; done: boolean }[]>
    readHistory: (filePath: string, id: number) => Promise<string>
    getHistoryDir: () => Promise<string>
    pickFolder: (defaultPath?: string) => Promise<string | null>
    setHistoryDir: (
      dir: string | null
    ) => Promise<{ ok: true; path: string } | { ok: false; error: string }>
    onTreeChanged: (callback: (tree: TreeNode[]) => void) => () => void
    onFileChanged: (callback: (filePath: string) => void) => () => void
    onExternalNameSanitized: (callback: (oldPath: string, newPath: string) => void) => () => void
    onFileExternallyRemoved: (callback: (filePath: string) => void) => () => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: MarkRoomApi
  }
}
