import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MarkdownEditor, type MarkdownEditorHandle } from './editor/MarkdownEditor'
import { MarkdownPreview, type MarkdownPreviewHandle } from './components/MarkdownPreview'
import { Sidebar, type SidebarHandle } from './components/Sidebar'
import { TabBar } from './components/TabBar'
import { SaveChangesDialog } from './components/SaveChangesDialog'
import { tabLabel } from './utils/tabLabel'
import { SearchPanel } from './components/SearchPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { ToastStack } from './components/ToastStack'
import { DiffView } from './components/DiffView'
import { HistoryDialog } from './components/HistoryDialog'
import { RecoveryDialog } from './components/RecoveryDialog'
import { ChangelogDialog } from './components/ChangelogDialog'
import { TocPanel } from './components/TocPanel'
import { TodoDialog } from './components/TodoDialog'
import { BacklinksPanel } from './components/BacklinksPanel'
import { toggleTaskAtLine } from './utils/tasks'
import { TitleBar } from './components/TitleBar'
import { useAppliedTheme } from './stores/useAppliedTheme'
import { useAppliedFonts } from './stores/useAppliedFonts'
import { useAppliedZoom } from './stores/useAppliedZoom'
import { useWorkspaceStore } from './stores/workspaceStore'
import { useTabsStore, type Tab } from './stores/tabsStore'
import { useSettingsStore } from './stores/settingsStore'
import { useToastStore } from './stores/toastStore'
import { flattenFilePaths, flattenNotes } from './utils/noteIndex'
import { matchesShortcut } from './utils/shortcuts'
import { extractToc } from './utils/toc'
import SearchIcon from './icons/search.svg?react'
import SettingsIcon from './icons/settings.svg?react'
import TodoIcon from './icons/todo.svg?react'
import BacklinksIcon from './icons/backlinks.svg?react'
import { readFileContent } from './utils/fileKind'
import { FileViewer } from './components/FileViewer'

const EXTERNAL_CHANGE_BATCH_WINDOW_MS = 600
const EDITOR_MIN_WIDTH = 396

const MOD = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
const TITLE_BTN =
  'flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text'
const EMPTY_HINTS: { label: string; keys: string }[] = [
  { label: '새 파일', keys: `${MOD}+N` },
  { label: '검색', keys: `${MOD}+P` },
  { label: '할 일', keys: `${MOD}+Shift+T` },
  { label: '백링크', keys: `${MOD}+Shift+B` },
  { label: '설정', keys: `${MOD}+,` }
]

function EmptyState(): React.JSX.Element {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center gap-7"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="text-center">
        <div className="text-[15px] font-medium tracking-tight text-text-secondary">MarkRoom</div>
      </div>
      <dl className="grid grid-cols-[auto_auto] items-center gap-x-8 gap-y-2.5 text-xs">
        {EMPTY_HINTS.map((h) => (
          <div key={h.label} className="contents">
            <dt className="text-text-tertiary">{h.label}</dt>
            <dd className="justify-self-end">
              <kbd
                className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-text-secondary"
                style={{ fontFamily: 'var(--font-editor)' }}
              >
                {h.keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}

function resolveNotePath(filePath: string): string {
  const norm = (p: string): string => p.replace(/\\/g, '/')
  const note = flattenNotes(useWorkspaceStore.getState().tree).find(
    (n) => norm(n.path) === norm(filePath)
  )
  return note?.path ?? filePath
}

interface RecoverableItem {
  tmpPath: string
  targetPath: string
  tmpContent: string
  currentContent: string | null
}

interface DiffPopupState {
  oldContent: string
  newContent: string
  oldLabel: string
  newLabel: string
  onApply: () => void
  onRestore: () => void
}

function App(): React.JSX.Element {
  useAppliedTheme()
  useAppliedFonts()
  useAppliedZoom()

  const rootDir = useWorkspaceStore((s) => s.rootDir)
  const tree = useWorkspaceStore((s) => s.tree)
  const setTree = useWorkspaceStore((s) => s.setTree)
  const setRootDir = useWorkspaceStore((s) => s.setRootDir)
  const tabs = useTabsStore((s) => s.tabs)
  const activeTabId = useTabsStore((s) => s.activeTabId)
  const openFile = useTabsStore((s) => s.openFile)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)
  const setContent = useTabsStore((s) => s.setContent)
  const markSaved = useTabsStore((s) => s.markSaved)
  const closeTab = useTabsStore((s) => s.closeTab)
  const syncExternalChange = useTabsStore((s) => s.syncExternalChange)
  const renamePath = useTabsStore((s) => s.renamePath)
  const markMissingByPath = useTabsStore((s) => s.markMissingByPath)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const isViewer = activeTab !== null && activeTab.kind !== 'text'
  const [sidebarWidth, setSidebarWidth] = useState(224)
  const sidebarResizing = useRef(false)
  const sidebarRef = useRef<SidebarHandle>(null)

  const splitRatio = useSettingsStore((s) => s.splitRatio)
  const setSplitRatio = useSettingsStore((s) => s.setSplitRatio)
  const [splitDraft, setSplitDraft] = useState<number | null>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const [previewMinWidth, setPreviewMinWidth] = useState(0)
  const [hasTemplate, setHasTemplate] = useState(false)
  const previewMinWidthRef = useRef(0)
  previewMinWidthRef.current = previewMinWidth

  const handleSplitResizeStart = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault()
      if (hasTemplate) return
      const box = splitRef.current
      if (!box) return
      const rect = box.getBoundingClientRect()
      let latest = useSettingsStore.getState().splitRatio
      const onMouseMove = (ev: MouseEvent): void => {
        const minRatio = Math.min(0.8, Math.max(0.2, EDITOR_MIN_WIDTH / rect.width))
        const maxRatio = Math.max(
          minRatio,
          Math.min(0.8, (rect.width - previewMinWidthRef.current - 1) / rect.width)
        )
        latest = Math.min(maxRatio, Math.max(minRatio, (ev.clientX - rect.left) / rect.width))
        setSplitDraft(latest)
      }
      const onMouseUp = (): void => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)
        setSplitRatio(latest)
        setSplitDraft(null)
      }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [setSplitRatio, hasTemplate]
  )

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    sidebarResizing.current = true
    const onMouseMove = (ev: MouseEvent): void => {
      if (!sidebarResizing.current) return
      setSidebarWidth(Math.min(480, Math.max(180, ev.clientX)))
    }
    const onMouseUp = (): void => {
      sidebarResizing.current = false
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 })
  const [vimModeLabel, setVimModeLabel] = useState('NORMAL')
  const [diffPopup, setDiffPopup] = useState<DiffPopupState | null>(null)
  const [historyTarget, setHistoryTarget] = useState<{ filePath: string; content: string } | null>(
    null
  )
  const [recoveryItems, setRecoveryItems] = useState<RecoverableItem[] | null>(null)
  const [changelog, setChangelog] = useState<string | null>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [tocFocusToken, setTocFocusToken] = useState(0)
  const [todoOpen, setTodoOpen] = useState(false)
  const [backlinksOpen, setBacklinksOpen] = useState(false)
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null)
  const [closeConfirm, setCloseConfirm] = useState<{ tabId: string; title: string } | null>(null)
  const pushToast = useToastStore((s) => s.push)
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const previewRef = useRef<MarkdownPreviewHandle>(null)
  const scrollSourceRef = useRef<'editor' | 'preview' | null>(null)
  const handleEditorScrollRatio = useCallback((ratio: number) => {
    if (scrollSourceRef.current === 'preview') return
    scrollSourceRef.current = 'editor'
    previewRef.current?.scrollToRatio(ratio)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollSourceRef.current = null
      })
    })
  }, [])
  const handlePreviewScrollRatio = useCallback((ratio: number) => {
    if (scrollSourceRef.current === 'editor') return
    scrollSourceRef.current = 'preview'
    editorRef.current?.scrollToRatio(ratio)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollSourceRef.current = null
      })
    })
  }, [])
  const externalChangeBufferRef = useRef<
    { filePath: string; title: string; oldContent: string; newContent: string }[]
  >([])
  const externalChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vimMode = useSettingsStore((s) => s.vimMode)
  const vimMouse = useSettingsStore((s) => s.vimMouse)
  const uiZoom = useSettingsStore((s) => s.uiZoom)
  const setUiZoom = useSettingsStore((s) => s.setUiZoom)
  const showLineCol = useSettingsStore((s) => s.showLineCol)
  const showWordCount = useSettingsStore((s) => s.showWordCount)
  const showCharCount = useSettingsStore((s) => s.showCharCount)
  const charCountIncludeSpaces = useSettingsStore((s) => s.charCountIncludeSpaces)
  const charCountExcludeSpaces = useSettingsStore((s) => s.charCountExcludeSpaces)

  const saveTab = useCallback(
    async (tabId: string): Promise<void> => {
      const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId)
      if (!tab || !tab.dirty) return
      const result = await window.api.workspace.saveNote({
        filePath: tab.filePath,
        content: tab.content
      })
      if (result.filePath) {
        markSaved(tabId, result.filePath)
      }
    },
    [markSaved]
  )

  useEffect(() => {
    void (async (): Promise<void> => {
      const dir = await window.api.workspace.getRootDir()
      setRootDir(dir)
      const initialTree = await window.api.workspace.getTree()
      setTree(initialTree)

      const known = new Set(flattenFilePaths(initialTree))
      let restored: { paths: string[]; activeTabId: string | null } | null = null
      try {
        const raw = localStorage.getItem('markroom-open-tabs')
        restored = raw ? JSON.parse(raw) : null
      } catch {
        restored = null
      }
      const validPaths = (restored?.paths ?? []).filter((p) => known.has(p))
      for (const p of validPaths) {
        useTabsStore.getState().openFile(p, await readFileContent(p))
      }
      if (restored?.activeTabId) {
        const restoredTab = useTabsStore
          .getState()
          .tabs.find((t) => t.filePath === restored?.activeTabId)
        if (restoredTab) setActiveTab(restoredTab.id)
      }

      const recoverable = await window.api.workspace.listRecoverable()
      if (recoverable.length > 0) setRecoveryItems(recoverable)
      const changelogToShow = await window.api.app.getChangelog()
      if (changelogToShow) setChangelog(changelogToShow)
    })()
  }, [setRootDir, setTree])

  useEffect(() => {
    const active = tabs.find((t) => t.id === activeTabId)
    const paths = tabs.filter((t) => t.filePath).map((t) => t.filePath as string)
    try {
      localStorage.setItem(
        'markroom-open-tabs',
        JSON.stringify({ paths, activeTabId: active?.filePath ?? null })
      )
    } catch {
      // 저장소를 쓸 수 없어도 앱은 계속 동작해요
    }
  }, [tabs, activeTabId])

  useEffect(() => {
    return window.api.workspace.onTreeChanged((newTree) => setTree(newTree))
  }, [setTree])

  useEffect(() => {
    return window.api.workspace.onExternalNameSanitized((oldPath, newPath) => {
      renamePath(oldPath, newPath)
      const newName = newPath.split(/[\\/]/).pop() ?? newPath
      pushToast({
        kind: 'info',
        message: `파일 이름에 사용할 수 없는 문자가 있어서 이름을 바꿨어요: "${newName}"`
      })
    })
  }, [renamePath, pushToast])

  useEffect(() => {
    return window.api.workspace.onFileExternallyRemoved((filePath) => {
      markMissingByPath(filePath)
    })
  }, [markMissingByPath])

  const flushExternalChangeBuffer = useCallback((): void => {
    const items = externalChangeBufferRef.current
    externalChangeBufferRef.current = []
    if (items.length === 0) return
    if (items.length >= 3) {
      pushToast({
        kind: 'external-change-batch',
        message: `외부에서 변경된 파일 ${items.length}개를 다시 불러왔어요.`,
        items
      })
    } else {
      for (const item of items) {
        pushToast({
          kind: 'external-change',
          message: `"${item.title}" 파일의 외부 변경 내용을 불러왔어요. Ctrl+Z로 되돌릴 수 있어요.`,
          filePath: item.filePath,
          oldContent: item.oldContent,
          newContent: item.newContent
        })
      }
    }
  }, [pushToast])

  useEffect(() => {
    return window.api.workspace.onFileChanged((changedPath) => {
      const tabsState = useTabsStore.getState()
      const priorTab = tabsState.tabs.find((t) => t.filePath === changedPath)
      void readFileContent(changedPath).then((fresh) => {
        syncExternalChange(changedPath, fresh)
        if (!priorTab || !priorTab.dirty || priorTab.content === fresh) return
        externalChangeBufferRef.current.push({
          filePath: changedPath,
          title: changedPath.split(/[\\/]/).pop() ?? changedPath,
          oldContent: priorTab.content,
          newContent: fresh
        })
        if (externalChangeTimerRef.current) clearTimeout(externalChangeTimerRef.current)
        externalChangeTimerRef.current = setTimeout(
          flushExternalChangeBuffer,
          EXTERNAL_CHANGE_BATCH_WINDOW_MS
        )
      })
    })
  }, [syncExternalChange, flushExternalChangeBuffer])

  const handleCursorChange = useCallback((pos: { line: number; col: number }): void => {
    setCursorPos(pos)
  }, [])

  const resolveNewNoteDir = useCallback(
    (explicitDir?: string): string => {
      if (explicitDir) return explicitDir
      if (selectedFolderPath) return selectedFolderPath
      const tabsState = useTabsStore.getState()
      const tab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
      if (tab?.filePath) {
        const idx = Math.max(tab.filePath.lastIndexOf('/'), tab.filePath.lastIndexOf('\\'))
        return idx >= 0 ? tab.filePath.slice(0, idx) : tab.filePath
      }
      return useWorkspaceStore.getState().rootDir ?? ''
    },
    [selectedFolderPath]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const shortcuts = useSettingsStore.getState().shortcuts
      if (matchesShortcut(e, shortcuts.save)) {
        e.preventDefault()
        const id = useTabsStore.getState().activeTabId
        if (id) void saveTab(id)
        return
      }
      if (matchesShortcut(e, shortcuts.search)) {
        e.preventDefault()
        setSearchOpen(true)
        return
      }
      if (matchesShortcut(e, shortcuts.newNote)) {
        e.preventDefault()
        sidebarRef.current?.startNewFile(resolveNewNoteDir())
        return
      }
      if (matchesShortcut(e, shortcuts.toggleSettings)) {
        e.preventDefault()
        setSettingsOpen((v) => !v)
        return
      }
      if (matchesShortcut(e, shortcuts.copyPathAbsolute)) {
        const tabsState = useTabsStore.getState()
        const tab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
        if (tab?.filePath) {
          e.preventDefault()
          void window.api.workspace.copyPath(tab.filePath, false)
        }
        return
      }
      if (matchesShortcut(e, shortcuts.copyPathRelative)) {
        const tabsState = useTabsStore.getState()
        const tab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
        if (tab?.filePath) {
          e.preventDefault()
          void window.api.workspace.copyPath(tab.filePath, true)
        }
        return
      }
      if (matchesShortcut(e, shortcuts.zoomIn)) {
        e.preventDefault()
        setUiZoom(useSettingsStore.getState().uiZoom + 10)
        return
      }
      if (matchesShortcut(e, shortcuts.zoomOut)) {
        e.preventDefault()
        setUiZoom(useSettingsStore.getState().uiZoom - 10)
        return
      }
      if (matchesShortcut(e, shortcuts.zoomReset)) {
        e.preventDefault()
        setUiZoom(100)
        return
      }
      if (matchesShortcut(e, shortcuts.toggleToc)) {
        e.preventDefault()
        setTocOpen((wasOpen) => {
          if (wasOpen) setTocFocusToken((n) => n + 1)
          return true
        })
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyT') {
        e.preventDefault()
        setTodoOpen((v) => !v)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyB') {
        e.preventDefault()
        setBacklinksOpen((v) => !v)
        return
      }
      if (e.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveTab, setUiZoom, settingsOpen, resolveNewNoteDir])

  useEffect(() => {
    const handler = (e: WheelEvent): void => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setUiZoom(useSettingsStore.getState().uiZoom + (e.deltaY < 0 ? 10 : -10))
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [setUiZoom])

  const handleOpenFile = useCallback(
    (filePath: string): void => {
      setSelectedFolderPath(null)
      void readFileContent(filePath).then((fileContent) => {
        openFile(filePath, fileContent)
      })
    },
    [openFile]
  )

  const handleEditorChange = useCallback(
    (tabId: string, value: string): void => {
      setContent(tabId, value)
    },
    [setContent]
  )

  const getNoteIndex = useCallback(() => flattenNotes(useWorkspaceStore.getState().tree), [])

  const getAttachmentDir = useCallback((): string => {
    const tab = useTabsStore
      .getState()
      .tabs.find((t) => t.id === useTabsStore.getState().activeTabId)
    if (!tab) return useWorkspaceStore.getState().rootDir ?? ''
    if (tab.filePath) return tab.filePath.replace(/[\\/][^\\/]*$/, '')
    return useWorkspaceStore.getState().rootDir ?? ''
  }, [])

  const handleCloseTab = useCallback(
    (tabId: string): void => {
      const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId)
      if (!tab) return
      if (!tab.dirty) {
        closeTab(tabId)
        return
      }
      setCloseConfirm({ tabId, title: tabLabel(tab) })
    },
    [closeTab]
  )
  const handleCloseOthers = useCallback(
    (tabId: string): void => {
      for (const tab of useTabsStore.getState().tabs) {
        if (tab.id !== tabId) handleCloseTab(tab.id)
      }
    },
    [handleCloseTab]
  )
  const handleCloseToRight = useCallback(
    (tabId: string): void => {
      const allTabs = useTabsStore.getState().tabs
      const idx = allTabs.findIndex((t) => t.id === tabId)
      if (idx === -1) return
      for (const tab of allTabs.slice(idx + 1)) handleCloseTab(tab.id)
    },
    [handleCloseTab]
  )
  const handleCloseAll = useCallback((): void => {
    for (const tab of useTabsStore.getState().tabs) handleCloseTab(tab.id)
  }, [handleCloseTab])
  const handleMissingTabClick = useCallback(
    (tab: Tab): void => {
      setActiveTab(tab.id)
      pushToast({ kind: 'info', message: '파일이 삭제되었거나 이동되었어요.' })
    },
    [setActiveTab, pushToast]
  )

  const handleEntryRenamed = useCallback(
    (oldPath: string, newPath: string): void => renamePath(oldPath, newPath),
    [renamePath]
  )
  const handleEntryMoved = useCallback(
    (oldPath: string, newPath: string): void => renamePath(oldPath, newPath),
    [renamePath]
  )

  const handleEntryDeleted = useCallback(
    (path: string): void => {
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === path)
      if (tab) closeTab(tab.id)
    },
    [closeTab]
  )

  const handleOpenDiffFromToast = useCallback(
    (filePath: string, oldContent: string, newContent: string): void => {
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath)
      if (tab) setActiveTab(tab.id)
      setDiffPopup({
        oldContent,
        newContent,
        oldLabel: '변경 전',
        newLabel: '외부에서 바뀐 내용',
        onApply: () => setDiffPopup(null),
        onRestore: () => {
          if (tab) setContent(tab.id, oldContent)
          setDiffPopup(null)
        }
      })
    },
    [setActiveTab, setContent]
  )

  const handleCompareChanges = useCallback(
    (filePath: string): void => {
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath)
      if (!tab) return
      void window.api.workspace.readFile(filePath).then((raw) => {
        setDiffPopup({
          oldContent: raw,
          newContent: tab.content,
          oldLabel: '마지막 저장',
          newLabel: '지금 편집 중',
          onApply: () => setDiffPopup(null),
          onRestore: () => {
            setContent(tab.id, raw)
            setDiffPopup(null)
          }
        })
      })
    },
    [setContent]
  )

  const handleOpenBaseDiff = useCallback((): void => {
    const state = useTabsStore.getState()
    const tab = state.tabs.find((t) => t.id === state.activeTabId)
    if (!tab) return
    const base = tab.baseContent
    setDiffPopup({
      oldContent: base,
      newContent: tab.content,
      oldLabel: '탭을 열었을 때',
      newLabel: '지금 편집 중',
      onApply: () => setDiffPopup(null),
      onRestore: () => {
        setContent(tab.id, base)
        setDiffPopup(null)
      }
    })
  }, [setContent])

  const handleOpenHistory = useCallback((filePath: string): void => {
    const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath)
    if (tab) {
      setHistoryTarget({ filePath, content: tab.content })
      return
    }
    void window.api.workspace.readFile(filePath).then((content) => {
      setHistoryTarget({ filePath, content })
    })
  }, [])

  const handleRestoreHistory = useCallback(
    (snapshot: string): void => {
      if (!historyTarget) return
      const { filePath, content } = historyTarget
      openFile(filePath, content)
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath)
      if (tab) setContent(tab.id, snapshot)
      setHistoryTarget(null)
      pushToast({
        kind: 'info',
        message: '이전 버전으로 되돌렸어요.'
      })
    },
    [historyTarget, openFile, setContent, pushToast]
  )
  const handleWikilinkClick = useCallback(
    (title: string): void => {
      const notes = flattenNotes(useWorkspaceStore.getState().tree)
      const match = notes.find((n) => n.title === title)
      if (match) {
        handleOpenFile(match.path)
      } else {
        pushToast({ kind: 'info', message: `"${title}" 파일을 찾을 수 없어요.` })
      }
    },
    [handleOpenFile, pushToast]
  )

  const handleOpenTodo = useCallback(
    (filePath: string, line: number): void => {
      setTodoOpen(false)
      const target = resolveNotePath(filePath)
      const jump = (): void => {
        setTimeout(() => editorRef.current?.scrollToLine(line), 80)
      }
      const existing = useTabsStore.getState().tabs.find((t) => t.filePath === target)
      if (existing) {
        setActiveTab(existing.id)
        jump()
        return
      }
      void window.api.workspace.readFile(target).then((content) => {
        openFile(target, content)
        jump()
      })
    },
    [setActiveTab, openFile]
  )

  const handleToggleTask = useCallback(
    (line: number): void => {
      const state = useTabsStore.getState()
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (!tab) return
      const next = toggleTaskAtLine(tab.content, line)
      if (next !== null) setContent(tab.id, next)
    },
    [setContent]
  )

  const handleReplaceSource = useCallback(
    (next: string): void => {
      const state = useTabsStore.getState()
      const tab = state.tabs.find((t) => t.id === state.activeTabId)
      if (!tab) return
      setContent(tab.id, next)
    },
    [setContent]
  )

  const handleToggleTodo = useCallback(
    async (filePath: string, line: number): Promise<void> => {
      const target = resolveNotePath(filePath)
      const tab = useTabsStore.getState().tabs.find((t) => t.filePath === target)
      if (tab) {
        const next = toggleTaskAtLine(tab.content, line - 1)
        if (next !== null) setContent(tab.id, next)
        return
      }
      const raw = await window.api.workspace.readFile(target)
      const next = toggleTaskAtLine(raw, line - 1)
      if (next === null) return
      await window.api.workspace.saveNote({
        filePath: target,
        content: next
      })
    },
    [setContent]
  )

  const getTodoOverrides = useCallback((): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const t of useTabsStore.getState().tabs) {
      if (t.filePath) out[t.filePath] = t.content
    }
    return out
  }, [])

  const tocEntries = useMemo(() => extractToc(activeTab?.content ?? ''), [activeTab?.content])
  const handleTocJump = useCallback((line: number) => {
    editorRef.current?.scrollToLine(line)
  }, [])
  const handleTocReturnFocus = useCallback(() => {
    editorRef.current?.focus()
  }, [])

  const wordCount = useMemo(() => {
    const content = activeTab?.content ?? ''
    return content.split(/\s+/).filter((w) => w.length > 0).length
  }, [activeTab?.content])
  const charCountWithSpaces = activeTab?.content.length ?? 0
  const charCountWithoutSpaces = useMemo(
    () => (activeTab?.content ?? '').replace(/\s/g, '').length,
    [activeTab?.content]
  )
  const dirtyFilePaths = useMemo(
    () => tabs.filter((t) => t.dirty && t.filePath).map((t) => t.filePath as string),
    [tabs]
  )
  const filePathLabel = activeTab?.filePath?.split(/[\\/]/).pop() ?? ''

  return (
    <div className="flex h-full flex-col bg-bg-soft text-text">
      <TitleBar>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          title="검색 (Ctrl+P)"
          className={TITLE_BTN}
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          title="설정 (Ctrl+,)"
          className={TITLE_BTN}
        >
          <SettingsIcon />
        </button>
        <button
          type="button"
          onClick={() => setTodoOpen((v) => !v)}
          title="할 일 (Ctrl+Shift+T)"
          className={TITLE_BTN}
        >
          <TodoIcon />
        </button>
        <button
          type="button"
          onClick={() => setBacklinksOpen((v) => !v)}
          title="백링크 (Ctrl+Shift+B)"
          className={TITLE_BTN}
        >
          <BacklinksIcon />
        </button>
      </TitleBar>
      <main className="flex min-h-0 flex-1 pb-2 pr-2">
        <div className="relative shrink-0" style={{ width: sidebarWidth }}>
          <Sidebar
            ref={sidebarRef}
            tree={tree}
            rootDir={rootDir}
            activeFilePath={activeTab?.filePath ?? null}
            onOpenFile={handleOpenFile}
            onFileCreated={handleOpenFile}
            onEntryRenamed={handleEntryRenamed}
            onEntryMoved={handleEntryMoved}
            onEntryDeleted={handleEntryDeleted}
            onFocusEditor={() => requestAnimationFrame(() => editorRef.current?.focus())}
            dirtyFilePaths={dirtyFilePaths}
            onCompareChanges={handleCompareChanges}
            onOpenHistory={handleOpenHistory}
            onOpenAtLine={handleOpenTodo}
            selectedFolderPath={selectedFolderPath}
            onSelectFolder={setSelectedFolderPath}
            className="h-full"
          />
          <div
            onMouseDown={handleSidebarResizeStart}
            className="group absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-bg">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={setActiveTab}
            onClose={handleCloseTab}
            onCloseOthers={handleCloseOthers}
            onCloseToRight={handleCloseToRight}
            onCloseAll={handleCloseAll}
            onMissingClick={handleMissingTabClick}
          />
          {activeTab && activeTab.kind !== 'text' && activeTab.filePath ? (
            <FileViewer  key={activeTab.id} filePath={activeTab.filePath} kind={activeTab.kind}/>
          ) : activeTab ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={splitRef} className="flex min-h-0 flex-1">
                <div
                  className="flex min-w-0 shrink-0"
                  style={{
                    width: `min(${(hasTemplate ? 0.5 : (splitDraft ?? splitRatio)) * 100}%, calc(100% - ${previewMinWidth + 1}px))`,
                    minWidth: EDITOR_MIN_WIDTH
                  }}
                >
                  <MarkdownEditor
                    ref={editorRef}
                    tabId={activeTab.id}
                    value={activeTab.content}
                    onChange={handleEditorChange}
                    getNoteIndex={getNoteIndex}
                    getAttachmentDir={getAttachmentDir}
                    vimMode={vimMode}
                    vimMouse={vimMouse}
                    baseContent={activeTab.baseContent}
                    onOpenBaseDiff={handleOpenBaseDiff}
                    onSave={() => {
                      const id = useTabsStore.getState().activeTabId
                      if (id) void saveTab(id)
                    }}
                    onVimModeChange={setVimModeLabel}
                    onCursorChange={handleCursorChange}
                    onScrollRatio={handleEditorScrollRatio}
                    className="min-w-0 flex-1 overflow-auto"
                  />
                </div>
                <div className="relative w-px shrink-0 bg-border">
                  <div
                    onMouseDown={handleSplitResizeStart}
                    onDoubleClick={() => {
                      if (!hasTemplate) setSplitRatio(0.5)
                    }}
                    className={`absolute inset-y-0 -left-1 z-10 w-2 ${hasTemplate ? '' : 'cursor-col-resize'}`}
                  />
                </div>
                <MarkdownPreview
                  ref={previewRef}
                  source={activeTab.content}
                  baseDir={getAttachmentDir()}
                  onScrollRatio={handlePreviewScrollRatio}
                  onWikilinkClick={handleWikilinkClick}
                  onToggleTask={handleToggleTask}
                  onReplaceSource={handleReplaceSource}
                  onMinWidthChange={setPreviewMinWidth}
                  onHasTemplateChange={setHasTemplate}
                  className="min-w-0 flex-1 overflow-auto px-6 pb-6 pt-3"
                />
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
          <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border px-3 text-[11px] tabular-nums text-text-tertiary">
            <div className="flex items-center gap-2">
              {vimMode && !isViewer ? (
                <span className="font-semibold text-accent">-- {vimModeLabel} --</span>
              ) : (
                <span className="truncate">{filePathLabel}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {vimMode && !isViewer && <span className="truncate">{filePathLabel}</span>}
              {activeTab && !isViewer && showLineCol && (
                <span>
                  {cursorPos.line}:{cursorPos.col}
                </span>
              )}

              {activeTab && !isViewer && showWordCount && <span>{wordCount}단어</span>}
              {activeTab && !isViewer && showCharCount && (charCountIncludeSpaces || charCountExcludeSpaces) && (
                <span>
                  {[
                    charCountIncludeSpaces ? `${charCountWithSpaces}자` : null,
                    charCountExcludeSpaces ? `공백 제외 ${charCountWithoutSpaces}자` : null
                  ]
                    .filter(Boolean)
                    .join(' / ')}
                </span>
              )}
              <button
                type="button"
                onClick={() => setUiZoom(100)}
                title="100%로 초기화"
                className="hover:text-text"
              >
                {uiZoom}%
              </button>
            </div>
          </footer>
        </div>
      </main>
      <AnimatePresence>
        {searchOpen && (
          <SearchPanel
            key="search-panel"
            rootDir={rootDir}
            onOpenFile={handleOpenFile}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {settingsOpen && (
          <SettingsPanel key="settings-panel" onClose={() => setSettingsOpen(false)} />
        )}
      </AnimatePresence>
      <ToastStack onOpenDiff={handleOpenDiffFromToast} />
      {diffPopup && (
        <DiffView
          oldContent={diffPopup.oldContent}
          newContent={diffPopup.newContent}
          oldLabel={diffPopup.oldLabel}
          newLabel={diffPopup.newLabel}
          onApply={diffPopup.onApply}
          onRestore={diffPopup.onRestore}
          onClose={() => setDiffPopup(null)}
        />
      )}
      {historyTarget && (
        <HistoryDialog
          filePath={historyTarget.filePath}
          currentContent={historyTarget.content}
          onRestore={handleRestoreHistory}
          onClose={() => setHistoryTarget(null)}
        />
      )}
      {recoveryItems && (
        <RecoveryDialog items={recoveryItems} onDone={() => setRecoveryItems(null)} />
      )}
      {changelog && <ChangelogDialog content={changelog} onClose={() => setChangelog(null)} />}
      {closeConfirm && (
        <SaveChangesDialog
          title={closeConfirm.title}
          onSave={() => {
            const { tabId } = closeConfirm
            setCloseConfirm(null)
            void saveTab(tabId).then(() => closeTab(tabId))
          }}
          onDiscard={() => {
            closeTab(closeConfirm.tabId)
            setCloseConfirm(null)
          }}
          onCancel={() => setCloseConfirm(null)}
        />
      )}
      {tocOpen && activeTab && !isViewer && (
        <TocPanel
          entries={tocEntries}
          onJump={handleTocJump}
          onClose={() => setTocOpen(false)}
          focusToken={tocFocusToken}
          onReturnFocus={handleTocReturnFocus}
        />
      )}
      <AnimatePresence>
        {todoOpen && (
          <TodoDialog
            key="todo-dialog"
            onOpen={handleOpenTodo}
            onToggle={handleToggleTodo}
            getOverrides={getTodoOverrides}
            onClose={() => setTodoOpen(false)}
          />
        )}
      </AnimatePresence>
      {backlinksOpen && activeTab && !isViewer && (
        <BacklinksPanel
          filePath={activeTab.filePath}
          onOpen={handleOpenTodo}
          onClose={() => setBacklinksOpen(false)}
        />
      )}
    </div>
  )
}

export default App
