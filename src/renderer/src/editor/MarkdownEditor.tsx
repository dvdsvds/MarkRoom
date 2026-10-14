import { mdToolbarKeys, mdToolbarPanel } from './editorToolbar'
import { slashMenu } from './slashMenu'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, drawSelection, tooltips, } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo
} from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { search, searchKeymap } from '@codemirror/search'
import { createFindPanel } from './findPanel'
import { vim, Vim } from '@replit/codemirror-vim'
import { wikilinkCompletionSource } from './wikilinkCompletion'
import { editingAssist } from './editingAssist'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { blockIndent } from './blockIndent'
import { colorSwatch } from './colorSwatch'
import type { NoteRef } from '../utils/noteIndex'
import { codeBlocks } from './codeBlocks'
import { templateCompletion, templateCompletionSource } from '../features/template/editor/templateCompletion'
import { selectionPerLine } from './selectionPerLine'
import { getCurrentView, setCurrentView } from './currentView'
import { selectionToolbar } from './selectionToolbar'
import { changeGutter } from './changeGutter'
import { foldChevronGutter } from './foldGutter'
import { listRenumber } from './listRenumber'
import { cursorMetrics } from './cursorMetrics'
import { koreanPhrases } from './findPhrases'
import { vimImeGuard } from './vimIme'
import { vimPointer } from './vimPointer'
import { vimModeTracker } from './vimMode'
import { pasteDrop } from './pasteDrop'
import { cursorReport, type CursorPosition } from './cursorReport'
import { markdownColors } from './markdownColors'
import { editorTheme } from './editorTheme'
import { listTabSpace } from './listTab'

const externalSync = Annotation.define<boolean>()

export interface MarkdownEditorHandle {
  focus: () => void
  scrollToLine: (line: number) => void
  scrollToRatio: (ratio: number) => void
}

interface MarkdownEditorProps {
  tabId: string
  value: string
  onChange: (tabId: string, value: string) => void
  getNoteIndex: () => NoteRef[]
  getAttachmentDir: () => string
  vimMode: boolean
  vimMouse: boolean
  baseContent: string
  onOpenBaseDiff?: () => void
  onSave?: () => void
  onCursorChange?: (pos: CursorPosition) => void
  onScrollRatio?: (ratio: number) => void
  onVimModeChange?: (mode: string) => void
  className?: string
}

const vimCompartment = new Compartment()
const toolbarCompartment = new Compartment()

export function undoEditor(): void {
  const view = getCurrentView()
  if (view) undo(view)
}

export function redoEditor(): void {
  const view = getCurrentView()
  if (view) redo(view)
}

export function selectEditorLines(fromLine: number, toLine: number): void {
  const view = getCurrentView()
  if (!view) return
  const doc = view.state.doc
  const a = Math.min(Math.max(1, fromLine), doc.lines)
  const b = Math.min(Math.max(a, toLine), doc.lines)
  view.dispatch({
    selection: { anchor: doc.line(a).from, head: doc.line(b).to },
    effects: EditorView.scrollIntoView(doc.line(a).from, { y: 'nearest' })
  })
}

function buildExtensions(
  getNoteIndex: () => NoteRef[],
  getAttachmentDir: () => string,
  vimModeInitial: boolean,
  reportCursor: (pos: CursorPosition) => void,
  reportVimMode: (mode: string) => void,
  getVimMouse: () => boolean,
  baseContent: string,
  onChangeClick: () => void
): Extension[] {
  const markdownLang = markdown({ base: markdownLanguage, codeLanguages: languages })
  return [
    cursorMetrics(),
    koreanPhrases,
    vimCompartment.of(vimModeInitial ? [vim()] : []),
    changeGutter(baseContent, onChangeClick),
    search({ top: true, createPanel: createFindPanel }),
    basicSetup,
    foldChevronGutter(),
    drawSelection({ cursorBlinkRate: 0 }),
    history(),
    blockIndent,
    colorSwatch,
    tooltips({ position: 'fixed', parent: document.body }),
    templateCompletion,
    codeBlocks,
    selectionPerLine,
    listTabSpace,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    markdownLang,
    markdownColors,
    selectionToolbar(),
    mdToolbarKeys,
    toolbarCompartment.of(useSettingsStore.getState().showToolbar ? mdToolbarPanel : []),
    slashMenu,
    vimImeGuard(),
    markdownLang.language.data.of({ autocomplete: wikilinkCompletionSource(getNoteIndex) }),
    markdownLang.language.data.of({ autocomplete: templateCompletionSource }),
    editingAssist(),
    listRenumber(),
    vimPointer(getVimMouse),
    pasteDrop(getAttachmentDir),
    EditorView.lineWrapping,
    vimModeTracker(reportVimMode),
    cursorReport(reportCursor),
    editorTheme
  ]
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      tabId,
      value,
      onChange,
      getNoteIndex,
      getAttachmentDir,
      vimMode,
      vimMouse,
      baseContent,
      onOpenBaseDiff,
      onSave,
      onCursorChange,
      onScrollRatio,
      onVimModeChange,
      className
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const statesRef = useRef<Map<string, EditorState>>(new Map())
    const currentTabIdRef = useRef<string>(tabId)
    const onChangeRef = useRef(onChange)
    const getNoteIndexRef = useRef(getNoteIndex)
    const getAttachmentDirRef = useRef(getAttachmentDir)
    const vimModeRef = useRef(vimMode)
    const vimMouseRef = useRef(vimMouse)
    const baseContentRef = useRef(baseContent)
    const onOpenBaseDiffRef = useRef(onOpenBaseDiff)
    const onSaveRef = useRef(onSave)
    const onCursorChangeRef = useRef(onCursorChange)
    const onScrollRatioRef = useRef(onScrollRatio)
    const onVimModeChangeRef = useRef(onVimModeChange)
    useEffect(() => {
      onChangeRef.current = onChange
      getNoteIndexRef.current = getNoteIndex
      getAttachmentDirRef.current = getAttachmentDir
      onCursorChangeRef.current = onCursorChange
      onScrollRatioRef.current = onScrollRatio
      onVimModeChangeRef.current = onVimModeChange
      vimMouseRef.current = vimMouse
      baseContentRef.current = baseContent
      onOpenBaseDiffRef.current = onOpenBaseDiff
      onSaveRef.current = onSave
    })

    useImperativeHandle(ref, () => ({
      focus: () => viewRef.current?.focus(),
      scrollToLine: (lineNumber: number) => {
        const view = viewRef.current
        if (!view) return
        const clamped = Math.min(Math.max(1, lineNumber), view.state.doc.lines)
        const line = view.state.doc.line(clamped)
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 40 })
        })
        view.focus()
      },
      scrollToRatio: (ratio: number) => {
        const view = viewRef.current
        if (!view) return
        const scroller = view.scrollDOM
        scroller.scrollTop = ratio * (scroller.scrollHeight - scroller.clientHeight)
      }
    }))

    function makeState(doc: string): EditorState {
      const updateListener = EditorView.updateListener.of((update) => {
        statesRef.current.set(currentTabIdRef.current, update.state)
        if (update.docChanged && !update.transactions.some((tr) => tr.annotation(externalSync))) {
          onChangeRef.current(currentTabIdRef.current, update.state.doc.toString())
        }
      })
      return EditorState.create({
        doc,
        extensions: [
          ...buildExtensions(
            () => getNoteIndexRef.current(),
            () => getAttachmentDirRef.current(),
            vimModeRef.current,
            (pos) => onCursorChangeRef.current?.(pos),
            (mode) => onVimModeChangeRef.current?.(mode),
            () => vimMouseRef.current,
            baseContentRef.current,
            () => onOpenBaseDiffRef.current?.()
          ),
          updateListener
        ]
      })
    }

    const editorFontSize = useSettingsStore((s) => s.editorFontSize)
    const editorLineHeight = useSettingsStore((s) => s.editorLineHeight)
    const editorFontFamily = useSettingsStore((s) => s.editorFontFamily)
    useEffect(() => {
      const id = requestAnimationFrame(() => viewRef.current?.requestMeasure())
      return () => cancelAnimationFrame(id)
    }, [editorFontSize, editorLineHeight, editorFontFamily])

    const showToolbar = useSettingsStore((s) => s.showToolbar)
    useEffect(() => {
      const effect = toolbarCompartment.reconfigure(showToolbar ? mdToolbarPanel : [])
      for (const [id, state] of statesRef.current) {
        if (id === currentTabIdRef.current) continue
        statesRef.current.set(id, state.update({ effects: effect }).state)
      }
      viewRef.current?.dispatch({ effects: effect })
    }, [showToolbar])

    useEffect(() => {
      vimModeRef.current = vimMode
      const effect = vimCompartment.reconfigure(vimMode ? [vim()] : [])
      for (const [id, state] of statesRef.current) {
        if (id === currentTabIdRef.current) continue
        statesRef.current.set(id, state.update({ effects: effect }).state)
      }
      viewRef.current?.dispatch({ effects: effect })
    }, [vimMode])

    useEffect(() => {
      if (!containerRef.current) return

      const initialState = makeState(value)
      statesRef.current.set(tabId, initialState)

      const view = new EditorView({ state: initialState, parent: containerRef.current })
      viewRef.current = view
      setCurrentView(view)
      Vim.defineEx('write', 'w', () => onSaveRef.current?.())

      const handleScroll = (): void => {
        const scroller = view.scrollDOM
        const max = scroller.scrollHeight - scroller.clientHeight
        onScrollRatioRef.current?.(max > 0 ? scroller.scrollTop / max : 0)
      }
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

      return (): void => {
        view.scrollDOM.removeEventListener('scroll', handleScroll)
        setCurrentView(null)
        view.destroy()
      }
    }, [])

    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      currentTabIdRef.current = tabId

      let state = statesRef.current.get(tabId)
      if (!state || state.doc.toString() !== value) {
        state = makeState(value)
        statesRef.current.set(tabId, state)
      }
      view.setState(state)
    }, [tabId])

    useEffect(() => {
      const view = viewRef.current
      if (!view || currentTabIdRef.current !== tabId) return
      const current = view.state.doc.toString()
      if (current !== value) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value },
          annotations: externalSync.of(true)
        })
      }
    }, [value])

    return <div ref={containerRef} className={className} />
  }
)
