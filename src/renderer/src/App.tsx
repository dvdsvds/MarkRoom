import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MarkdownEditor, type MarkdownEditorHandle } from './editor/MarkdownEditor'
import { MarkdownPreview, type MarkdownPreviewHandle } from './features/preview/MarkdownPreview'
import { Sidebar, type SidebarHandle } from './features/sidebar/Sidebar'
import { TabBar } from './components/TabBar'
import { SaveChangesDialog } from './components/SaveChangesDialog'
import { useTabClose } from './hooks/useTabClose'
import { useSidebarResize } from './hooks/useSidebarResize'
import { useSplitResize, EDITOR_MIN_WIDTH } from './hooks/useSplitResize'
import { restoreOpenTabs, usePersistOpenTabs } from './hooks/useOpenTabsPersistence'
import { SearchPanel } from './components/SearchPanel'
import { SettingsPanel } from './features/settings/SettingsPanel'
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
import { findHeadingLine } from './utils/wikilink'
import { useCursorStore } from './stores/cursorStore'
import { extractToc } from './utils/toc'
import SearchIcon from './icons/search.svg?react'
import SettingsIcon from './icons/settings.svg?react'
import TodoIcon from './icons/todo.svg?react'
import BacklinksIcon from './icons/backlinks.svg?react'
import SidebarIcon  from './icons/sidebar.svg?react'
import GrpahIcon from './icons/graph.svg?react'
import { readTextFile, fileKindOf, isMarkdownPath } from './utils/fileKind'
import { FileViewer } from './components/FileViewer'
import { EmptyState } from './components/EmptyState'
import { StatusBar } from './components/StatusBar'
import { useWorkspaceEvents } from './hooks/useWorkspaceEvents'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { dirOf, fileNameOf, splitName, sepOf } from './utils/path'
import { GraphDialog } from './components/GraphDialog'
import { useNotePropsStore } from './stores/notePropsStore'
import { TagBar } from './components/TagBar'

const TITLE_BTN =
  'flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-mute hover:text-text'

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
  useWorkspaceEvents()
  usePersistOpenTabs()

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
  const renamePath = useTabsStore((s) => s.renamePath)
  const rewriteWikilinks = useTabsStore((s) => s.rewriteWikilinks)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null
  const tagBarPath = activeTab?.kind === 'text' && !activeTab.missing && activeTab.filePath?.toLowerCase().endsWith('.md') ? activeTab.filePath : null
  const isViewer = activeTab !== null && activeTab.kind !== 'text'
  const showPreview = !activeTab?.filePath || isMarkdownPath(activeTab.filePath)
  const sidebarRef = useRef<SidebarHandle>(null)

  const splitRef = useRef<HTMLDivElement>(null)
  const [previewMinWidth, setPreviewMinWidth] = useState(0)
  const [hasTemplate, setHasTemplate] = useState(false)
  const sidebar = useSidebarResize()
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useSettingsStore((s) => s.setSidebarCollapsed)
  const split = useSplitResize(splitRef, hasTemplate, previewMinWidth)

  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
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
  const [graphOpen, setGraphOpen] = useState(false)
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null)
  const pushToast = useToastStore((s) => s.push)
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const previewRef = useRef<MarkdownPreviewHandle>(null)
  const scrollSourceRef = useRef<'editor' | 'preview' | 'jump' | null>(null)
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 특정 줄로 이동할 때는 에디터와 미리보기를 각각 그 위치로 맞추고,
  // 그 직후 생기는 스크롤 이벤트로 서로를 비율로 다시 끌고 가지 않게 잠깐 동기화를 멈춘다
  const jumpToLine = useCallback((line: number) => {
    scrollSourceRef.current = 'jump'
    editorRef.current?.scrollToLine(line)
    previewRef.current?.scrollToLine(line)
    if (jumpTimerRef.current) clearTimeout(jumpTimerRef.current)
    jumpTimerRef.current = setTimeout(() => {
      scrollSourceRef.current = null
    }, 150)
  }, [])
  const handleEditorScrollRatio = useCallback((ratio: number) => {
    if (scrollSourceRef.current === 'preview' || scrollSourceRef.current === 'jump') return
    scrollSourceRef.current = 'editor'
    previewRef.current?.scrollToRatio(ratio)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollSourceRef.current = null
      })
    })
  }, [])
  const handlePreviewScrollRatio = useCallback((ratio: number) => {
    if (scrollSourceRef.current === 'editor' || scrollSourceRef.current === 'jump') return
    scrollSourceRef.current = 'preview'
    editorRef.current?.scrollToRatio(ratio)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollSourceRef.current = null
      })
    })
  }, [])
  const vimMode = useSettingsStore((s) => s.vimMode)
  const vimMouse = useSettingsStore((s) => s.vimMouse)

  const saveTab = useCallback(
    async (tabId: string): Promise<void> => {
      const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId)
      if (!tab || !tab.dirty) return
      const result = await window.api.workspace.saveNote({
        filePath: tab.filePath,
        content: tab.content
      })
      if (result.filePath) {
        markSaved(tabId, result.filePath, tab.content)
      }
    },
    [markSaved]
  )

  const saveActiveTab = useCallback((): void => {
    const id = useTabsStore.getState().activeTabId
    if (id) void saveTab(id)
  }, [saveTab])

  const tabClose = useTabClose(saveTab)
  const { requestQuit } = tabClose

  useEffect(
    () =>
      window.api.window.onCloseRequested(() =>
        requestQuit(() => void window.api.window.confirmClose())
      ),
    [requestQuit]
  )

  useEffect(() => {
    void (async (): Promise<void> => {
      const dir = await window.api.workspace.getRootDir()
      setRootDir(dir)
      const initialTree = await window.api.workspace.getTree()
      setTree(initialTree)
      await useNotePropsStore.getState().load()

      await restoreOpenTabs(new Set(flattenFilePaths(initialTree)))

      const recoverable = await window.api.workspace.listRecoverable()
      if (recoverable.length > 0) setRecoveryItems(recoverable)
      const changelogToShow = await window.api.app.getChangelog()
      if (changelogToShow) setChangelog(changelogToShow)
    })()
  }, [setRootDir, setTree])

  const handleCursorChange = useCallback((pos: { line: number; col: number }): void => {
    useCursorStore.getState().setCursor(pos)
  }, [])

  const resolveNewNoteDir = useCallback(
    (explicitDir?: string): string => {
      if (explicitDir) return explicitDir
      if (selectedFolderPath) return selectedFolderPath
      const tabsState = useTabsStore.getState()
      const tab = tabsState.tabs.find((t) => t.id === tabsState.activeTabId)
      if (tab?.filePath) return dirOf(tab.filePath)
      return useWorkspaceStore.getState().rootDir ?? ''
    },
    [selectedFolderPath]
  )

  useGlobalShortcuts({
    settingsOpen,
    save: saveActiveTab,
    openSearch: () => setSearchOpen(true),
    newFile: () => {
      setSidebarCollapsed(false)
      sidebarRef.current?.startNewFile(resolveNewNoteDir())
    },
    toggleSettings: () => setSettingsOpen((v) => !v),
    closeSettings: () => setSettingsOpen(false),
    openOrFocusToc: () =>
      setTocOpen((wasOpen) => {
        if (wasOpen) setTocFocusToken((n) => n + 1)
        return true
      }),
    toggleTodo: () => setTodoOpen((v) => !v),
    toggleBacklinks: () => setBacklinksOpen((v) => !v),
    toggleSidebar: () => setSidebarCollapsed(!useSettingsStore.getState().sidebarCollapsed),
    toggleGraph: () => setGraphOpen((v) => !v)
  })

  const handleOpenFile = useCallback(
    (filePath: string): void => {
      setSelectedFolderPath(null)
      const openExternally = (): void => {
        void window.api.workspace.openInDefaultApp(filePath).then((error) => {
          if (error) pushToast({ kind: 'info', message: '이 파일을 열 수 있는 앱이 없어요.' })
        })
      }
      const kind = fileKindOf(filePath)
      if (kind === 'external') {
        openExternally()
        return
      }
      if (kind !== 'text') {
        openFile(filePath, '')
        return
      }
      if (useTabsStore.getState().tabs.some((t) => t.filePath === filePath)) {
        openFile(filePath, '')
        return
      }
      void readTextFile(filePath).then((result) => {
        if (result.ok) {
          openFile(filePath, result.content)
          return
        }
        pushToast({
          kind: 'info',
          message:
            result.reason === 'tooLarge'
              ? '20MB가 넘는 파일이라 폴더에서 보여 드려요.'
              : '텍스트로 열 수 없는 파일이라 폴더에서 보여 드려요.'
        })
        void window.api.workspace.reveal(filePath)
      })
    },
    [openFile, pushToast]
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
    if (tab.filePath) return dirOf(tab.filePath)
    return useWorkspaceStore.getState().rootDir ?? ''
  }, [])

  const handleMissingTabClick = useCallback(
    (tab: Tab): void => {
      setActiveTab(tab.id)
      pushToast({ kind: 'info', message: '파일이 삭제되었거나 이동되었어요.' })
    },
    [setActiveTab, pushToast]
  )

  const handleEntryRenamed = useCallback(
    (oldPath: string, newPath: string): void => {
      renamePath(oldPath, newPath)
      const oldName = splitName(fileNameOf(oldPath))
      const newName = splitName(fileNameOf(newPath))
      if (oldName.ext.toLowerCase() === '.md' && newName.ext.toLowerCase() === '.md') {
        rewriteWikilinks(oldName.base, newName.base)
      }
      void useNotePropsStore.getState().load()
    },
    [renamePath, rewriteWikilinks]
  )

  const handleEntryMoved = useCallback(
    (oldPath: string, newPath: string): void => {
      renamePath(oldPath, newPath)
      void useNotePropsStore.getState().load()
    },
    [renamePath]
  )

  const handleEntryDeleted = useCallback(
    (path: string): void => {
      const prefix = path + sepOf(path)
      const doomed = useTabsStore.getState().tabs.filter((t) => t.filePath === path || t.filePath?.startsWith(prefix))
      for (const tab of doomed) closeTab(tab.id)
      void useNotePropsStore.getState().load()
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
  const handleLinkClick = useCallback(
    (href: string): void => {
      let rel = href.split('#')[0].split('?')[0]
      try {
        rel = decodeURIComponent(rel)
      } catch {
      }
      if (!rel) return
      const base = getAttachmentDir()
      const sep = base.includes('\\') ? '\\' : '/'
      const lead = base.startsWith('/') ? '/' : ''
      const out: string[] = []
      for (const p of `${base}/${rel}`.split(/[\\/]/)) {
        if (p === '..') out.pop()
        else if (p !== '.' && p !== '') out.push(p)
      }
      handleOpenFile(lead + out.join(sep))
    },
    [getAttachmentDir, handleOpenFile]
  )

  const handleOpenTodo = useCallback(
    (filePath: string, line: number): void => {
      setTodoOpen(false)
      const target = resolveNotePath(filePath)
      const jump = (): void => {
        setTimeout(() => jumpToLine(line), 80)
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
    [setActiveTab, openFile, jumpToLine]
  )

  const handleWikilinkClick = useCallback(
    (title: string, heading: string | null): void => {
      // `[[#제목]]`은 지금 보고 있는 노트를 가리킨다
      const targetPath = title
        ? flattenNotes(useWorkspaceStore.getState().tree).find((n) => n.title === title)?.path
        : (useTabsStore.getState().tabs.find((t) => t.id === useTabsStore.getState().activeTabId)
            ?.filePath ?? undefined)
      if (!targetPath) {
        pushToast({ kind: 'info', message: `"${title}" 파일을 찾을 수 없어요.` })
        return
      }
      if (!heading) {
        handleOpenFile(targetPath)
        return
      }
      const openTab = useTabsStore.getState().tabs.find((t) => t.filePath === targetPath)
      const loadContent = openTab
        ? Promise.resolve(openTab.content)
        : window.api.workspace.readFile(targetPath)
      void loadContent.then((content) => {
        const line = findHeadingLine(content, heading)
        if (line === null) {
          handleOpenFile(targetPath)
          pushToast({ kind: 'info', message: `'${heading}' 제목을 찾을 수 없어요.` })
          return
        }
        handleOpenTodo(targetPath, line)
      })
    },
    [handleOpenFile, handleOpenTodo, pushToast]
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
  const handleTocJump = useCallback(
    (line: number) => {
      jumpToLine(line)
    },
    [jumpToLine]
  )
  const handleTocReturnFocus = useCallback(() => {
    editorRef.current?.focus()
  }, [])

  const dirtyFilePaths = useMemo(
    () => tabs.filter((t) => t.dirty && t.filePath).map((t) => t.filePath as string),
    [tabs]
  )

  return (
    <div className="flex h-full flex-col bg-bg-soft text-text">
      <TitleBar>
        <button
          type="button"
          onClick={() => { 
            setSidebarCollapsed(!sidebarCollapsed)
          }}
          title={`사이드바 ${sidebarCollapsed ? '펼치기' : '접기'} (Ctrl+Shift+E)`}
          className={TITLE_BTN}
        >
          <SidebarIcon />
        </button>
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
        <button
          type="button"
          onClick={() => setGraphOpen((v) => !v)}
          title="그래프 (Ctrl+Shift+G)"
          className={TITLE_BTN}
        >
          <GrpahIcon />
        </button>
      </TitleBar>
      <main className="flex min-h-0 flex-1 pb-2 pr-2">
        <motion.div
          className="relative shrink-0"
          initial={false}
          animate={{ width: sidebarCollapsed ? 8 : sidebar.width }}
          transition={{ duration: sidebar.resizing ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="h-full overflow-hidden" inert={sidebarCollapsed}>
            <div className="h-full" style={{ width: sidebar.width }}>
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
            </div>
        </div>
        {!sidebarCollapsed && (
          <div
            onMouseDown={sidebar.onResizeStart}
            className="group absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent" />
          </div>
        )}
      </motion.div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-bg">
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onSelect={setActiveTab}
            onClose={tabClose.requestClose}
            onCloseAll={tabClose.closeAll}
            onMissingClick={handleMissingTabClick}
          />
          {tagBarPath && <TagBar filePath={tagBarPath} />}
          {activeTab && activeTab.kind !== 'text' && activeTab.filePath ? (
            <FileViewer  key={activeTab.id} filePath={activeTab.filePath} kind={activeTab.kind}/>
          ) : activeTab ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div ref={splitRef} className="flex min-h-0 flex-1">
                <div
                  className="flex min-w-0 shrink-0"
                  style={
                    showPreview
                      ? {
                          width: `min(${split.ratio * 100}%, calc(100% - ${previewMinWidth + 1}px))`,
                          minWidth: EDITOR_MIN_WIDTH
                        }
                      : { width: '100%' }
                  }
                >
                  <MarkdownEditor
                    ref={editorRef}
                    tabId={activeTab.id}
                    filePath={activeTab.filePath}
                    value={activeTab.content}
                    onChange={handleEditorChange}
                    getNoteIndex={getNoteIndex}
                    getAttachmentDir={getAttachmentDir}
                    vimMode={vimMode}
                    vimMouse={vimMouse}
                    baseContent={activeTab.baseContent}
                    onOpenBaseDiff={handleOpenBaseDiff}
                    onSave={saveActiveTab}
                    onVimModeChange={setVimModeLabel}
                    onCursorChange={handleCursorChange}
                    onScrollRatio={handleEditorScrollRatio}
                    className="min-w-0 flex-1 overflow-auto"
                  />
                </div>
                {showPreview && (
                  <div className="relative w-px shrink-0 bg-border">
                    <div
                      onMouseDown={split.onResizeStart}
                      onDoubleClick={split.resetRatio}
                      className={`absolute inset-y-0 -left-1 z-10 w-2 ${hasTemplate ? '' : 'cursor-col-resize'}`}
                    />
                  </div>
                )}
                {showPreview && (
                  <MarkdownPreview
                    ref={previewRef}
                    source={activeTab.content}
                    baseDir={getAttachmentDir()}
                    onScrollRatio={handlePreviewScrollRatio}
                    onWikilinkClick={handleWikilinkClick}
                    onToggleTask={handleToggleTask}
                    onLinkClick={handleLinkClick}
                    onReplaceSource={handleReplaceSource}
                    onMinWidthChange={setPreviewMinWidth}
                    onHasTemplateChange={setHasTemplate}
                    className="min-w-0 flex-1 overflow-auto px-[var(--preview-pad)] pb-6 pt-3"
                    docKey={activeTab.id}
                  />
                )}
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
          <StatusBar
            tab={activeTab}
            isViewer={isViewer}
            vimModeLabel={vimModeLabel}
          />
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
      {tabClose.closeConfirm && (
        <SaveChangesDialog
          title={tabClose.closeConfirm.title}
          onSave={tabClose.confirmSave}
          onDiscard={tabClose.confirmDiscard}
          onCancel={tabClose.cancelClose}
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
      <AnimatePresence>
        {graphOpen && (
          <GraphDialog
            key="graph-dialog"
            activePath={activeTab?.filePath ?? null}
            onOpen={(filePath) => {
              setGraphOpen(false)
              handleOpenFile(filePath)
            }}
            onClose={() => setGraphOpen(false)}
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