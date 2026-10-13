import { mdToolbarKeys, mdToolbarPanel } from './editorToolbar'
import { slashMenu } from './slashMenu'
import { HighlightStyle, syntaxHighlighting, syntaxTree, } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  Annotation,
  Compartment,
  EditorState,
  Prec,
  RangeSetBuilder,
  type Extension
} from '@codemirror/state'
import {
  EditorView,
  keymap,
  drawSelection,
  Decoration,
  ViewPlugin,
  tooltips,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
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
import { vim, getCM, Vim } from '@replit/codemirror-vim'
import { wikilinkCompletionSource } from './wikilinkCompletion'
import { insertAttachments } from './attachments'
import { editingAssist } from './editingAssist'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { blockIndent } from './blockIndent'
import { colorSwatch } from './colorSwatch'
import type { NoteRef } from '../utils/noteIndex'
import { codeBlocks } from './codeBlocks'
import { findTemplateBlocks } from '@renderer/markdown/templateExtract'
import { templateCompletion, templateCompletionSource } from './templateCompletion'
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

const externalSync = Annotation.define<boolean>()

interface CursorPosition {
  line: number
  col: number
}

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

export function openTableEditor(which: number | 'cursor'): boolean {
  const view = getCurrentView()
  if (!view) return false
  const doc = view.state.doc
  const source = doc.toString()
  const blocks = findTemplateBlocks(source)
  const idx =
    which === 'cursor'
      ? blocks.findIndex((b) => {
          const n = doc.lineAt(view.state.selection.main.head).number
          return n >= b.start && n <= b.end
        })
      : which - 1
  const b = blocks[idx]
  if (!b) return false
  return true
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

const markdownHighlight = HighlightStyle.define([
  { tag: tags.processingInstruction, color: 'var(--color-text-tertiary)' },
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    fontWeight: '400',
    color: 'var(--color-syntax-heading)'
  },
  { tag: tags.strong, fontWeight: '400', color: 'var(--color-syntax-strong)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--color-syntax-em)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--color-text-secondary)' },
  { tag: tags.monospace, fontFamily: 'var(--font-editor)', color: 'var(--color-syntax-code)' },
  { tag: tags.quote, color: 'var(--color-syntax-mark)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--color-text)' },
  { tag: tags.contentSeparator, color: 'var(--color-border-strong)' }
])

const markDeco = (color: string): Decoration =>
  Decoration.mark({ attributes: { style: `color: ${color}` } })

const symbolDecos: Record<string, Decoration> = {
  HeaderMark: markDeco('var(--color-syntax-heading)'),
  QuoteMark: markDeco('var(--color-syntax-mark)'),
  BulletMark: markDeco('var(--color-syntax-bullet)'),
  OrderedMark: markDeco('var(--color-syntax-bullet)'),
  StrongMark: markDeco('var(--color-syntax-strong)'),
  EmMark: markDeco('var(--color-syntax-em)'),
  CodeMark: markDeco('var(--color-syntax-fence)'),
  TaskMarker: markDeco('var(--color-syntax-task)'),
  StrikethroughMark: markDeco('var(--color-text-tertiary)'),
  Link: markDeco('var(--color-accent)'),
  LinkMark: markDeco('var(--color-text-secondary)'),
  URL: markDeco('var(--color-text-secondary)')
}

function buildSymbolDecos(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        let key: string = node.name
        if (key === 'ListMark') {
          key = node.node.parent?.parent?.name === 'OrderedList' ? 'OrderedMark' : 'BulletMark'
        } else if (key === 'EmphasisMark') {
          key = node.node.parent?.name === 'StrongEmphasis' ? 'StrongMark' : 'EmMark'
        }
        const deco = symbolDecos[key]
        if (deco) builder.add(node.from, node.to, deco)
      }
    })
  }
  return builder.finish()
}

const markdownSymbolColors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildSymbolDecos(view)
    }
    update(u: ViewUpdate): void {
      if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = buildSymbolDecos(u.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)

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
  let lastVimMode = ''
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
    Prec.high(keymap.of([{ key: 'Mod-Shift-e', run: () => openTableEditor('cursor') }])),
    colorSwatch,
    tooltips({ position: 'fixed', parent: document.body }),
    templateCompletion,
    codeBlocks,
    selectionPerLine,
    Prec.high(
      keymap.of([
        {
          key: 'Tab',
          run: (view) => {
            const pos = view.state.selection.main.head
            const line = view.state.doc.lineAt(pos)
            const beforeCursor = line.text.slice(0, pos - line.from)
            if (pos !== line.to || !/^\s*[-*+]$/.test(beforeCursor)) return false
            view.dispatch({
              changes: { from: pos, insert: ' ' },
              selection: { anchor: pos + 1 }
            })
            return true
          }
        }
      ])
    ),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    markdownLang,
    syntaxHighlighting(markdownHighlight),
    Prec.highest(markdownSymbolColors),
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
    EditorView.domEventHandlers({
      paste(event, view) {
        const files = Array.from(event.clipboardData?.files ?? [])
        if (files.length === 0) return false
        event.preventDefault()
        void insertAttachments(files, view, getAttachmentDir(), true)
        return true
      },
      drop(event, view) {
        const files = Array.from(event.dataTransfer?.files ?? [])
        if (files.length === 0) return false
        event.preventDefault()
        void insertAttachments(files, view, getAttachmentDir(), false)
        return true
      }
    }),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      const cm = getCM(update.view)
      const vimState = cm?.state.vim
      if (!vimState) return
      const mode = vimState.insertMode
        ? 'INSERT'
        : vimState.visualMode
          ? vimState.visualLine
            ? 'VISUAL LINE'
            : vimState.visualBlock
              ? 'VISUAL BLOCK'
              : 'VISUAL'
          : 'NORMAL'
      reportVimMode(mode)
      if (mode === 'NORMAL') {
        const sel = update.state.selection.main
        const line = update.state.doc.lineAt(sel.head)
        if (sel.empty && line.length > 0 && sel.head === line.to) {
          const view = update.view
          queueMicrotask(() => {
            if (view.state.selection.main.head === sel.head) {
              view.dispatch({ selection: { anchor: sel.head - 1 } })
            }
          })
        }
      }
      if (mode !== lastVimMode) {
        lastVimMode = mode
        requestAnimationFrame(() => cm?.state.vimPlugin?.blockCursor?.scheduleRedraw())
      }
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged && !update.selectionSet) return
      const pos = update.state.selection.main.head
      const line = update.state.doc.lineAt(pos)
      reportCursor({ line: line.number, col: pos - line.from + 1 })
    }),
    EditorView.theme({
      '&': { height: '100%', fontSize: 'var(--editor-font-size)' },
      '.cm-content': {
        fontFamily: 'var(--font-editor)',
        fontWeight: '300',
        lineHeight: 'var(--editor-line-height)',
        caretColor: 'var(--color-accent)',
        paddingTop: '0px',
        paddingBottom: '0px'
      },
      '.cm-cursor, .cm-cursor-primary': {
        borderLeftColor: 'var(--color-text)',
        borderLeftWidth: '2px'
      },
      '&:not(.cm-focused) .cm-vimCursorLayer': {
        display: 'none !important'
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: 'var(--color-text-tertiary)',
        border: 'none',
        fontSize: '0.9em'
      },
      '.cm-lineNumbers .cm-gutterElement': {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end'
      },
      '&.cm-focused': { outline: 'none' }
    })
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
