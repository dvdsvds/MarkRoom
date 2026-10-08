import { mdToolbar } from './editorToolbar'
import { HighlightStyle, syntaxHighlighting, syntaxTree, foldable, foldedRanges, foldEffect, unfoldEffect } from '@codemirror/language'
import chevronSvg from '../icons/chevron.svg?raw'
import { tags } from "@lezer/highlight"
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Annotation, ChangeSet, Compartment, EditorState, Prec, RangeSetBuilder, StateEffect, StateField, RangeSet, type Text, type Extension } from '@codemirror/state'
import { EditorView, keymap, drawSelection, Decoration, ViewPlugin, showTooltip, gutter, GutterMarker, tooltips, type DecorationSet, type ViewUpdate, type Tooltip, type TooltipView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { searchKeymap } from '@codemirror/search'
import { vim, getCM, Vim } from '@replit/codemirror-vim'
import { wikilinkCompletionSource } from './wikilinkCompletion'
import { insertAttachments } from './attachments'
import { editingAssist } from './editingAssist'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { diffToRows } from '../utils/diff'
import { blockIndent } from './blockIndent'
import { colorSwatch } from './colorSwatch'
import type { NoteRef } from '../utils/noteIndex'
import { codeBlocks } from './codeBlocks'
import { findTemplateBlocks } from '@renderer/markdown/templateExtract'
import { templateCompletion, templateCompletionSource } from './templateCompletion'
import { selectionPerLine } from './selectionPerLine'

let imeGuardUntil = 0
const imeRestore = Annotation.define<boolean>()
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
let currentView: EditorView | null = null

export function undoEditor(): void {
  if (currentView) undo(currentView)
}

export function redoEditor(): void {
  if (currentView) redo(currentView)
}

export function openTableEditor(which: number | 'cursor'): boolean {
  const view = currentView
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
  const view = currentView
  if (!view) return
  const doc = view.state.doc
  const a = Math.min(Math.max(1, fromLine), doc.lines)
  const b = Math.min(Math.max(a, toLine), doc.lines)
  view.dispatch({
    selection: { anchor: doc.line(a).from, head: doc.line(b).to },
    effects: EditorView.scrollIntoView(doc.line(a).from, { y: 'nearest' })
  })
}

const cellIndent = (def: string): string => (/^\s*/.exec(def)?.[0] ?? '') + '  '
const cellBody = (def: string, text: string): string[] =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => cellIndent(def) + l)

/** col= 칸 정의 줄(defLine) 아래의 글자 줄(endLine까지)을 새 글자로 바꾼다. */
export function replaceCellText(defLine: number, endLine: number, text: string): void {
  const view = currentView
  if (!view) return
  const doc = view.state.doc
  if (defLine < 1 || defLine > doc.lines) return
  const def = doc.line(defLine)
  const last = doc.line(Math.min(Math.max(defLine, endLine), doc.lines))
  const body = cellBody(def.text, text)
  view.dispatch({
    changes: { from: def.to, to: last.to, insert: body.length > 0 ? '\n' + body.join('\n') : '' },
    userEvent: 'input.cell'
  })
}

export function readGrid<T>(compute: (getLine: (n: number) => string) => T): T | null {
  const view = currentView
  if (!view) return null
  const doc = view.state.doc
  return compute((n) => doc.line(n).text)
}

/** 격자 편집(합치기/나누기) 결과를 문서에 적용한다. 실패하면 오류 글자를, 성공하면 null을 돌려준다. */
export function applyGridEdit(
  compute: (getLine: (n: number) => string) => { ok: true; from: number; to: number; lines: string[] } | { ok: false; error: string }
): string | null {
  const view = currentView
  if (!view) return '편집기를 찾을 수 없어요'
  const doc = view.state.doc
  const r = compute((n) => (n >= 1 && n <= doc.lines ? doc.line(n).text : ''))
  if (!r.ok) return r.error
  if (r.from < 1 || r.to > doc.lines || r.from > r.to) return '격자 위치가 맞지 않아요'
  view.dispatch({
    changes: { from: doc.line(r.from).from, to: doc.line(r.to).to, insert: r.lines.join('\n') },
    userEvent: 'input.cell'
  })
  return null
}

/** text 노드 줄(line)에서 첫 ':' 뒤를 새 글자로 바꾼다. */
export function replaceTextLine(line: number, text: string): void {
  const view = currentView
  if (!view) return
  const doc = view.state.doc
  if (line < 1 || line > doc.lines) return
  const l = doc.line(line)
  const i = l.text.indexOf(':')
  if (i < 0) return
  const body = text.replace(/\s*[\r\n]+\s*/g, ' ').trim()
  view.dispatch({
    changes: { from: l.from + i + 1, to: l.to, insert: ' ' + body },
    userEvent: 'input.cell'
  })
}

/** text 노드 줄을 커서 기준으로 둘로 나눈다. 앞 글자는 그 줄에, 뒤 글자는 같은 머리말의 새 줄에 넣는다. */
export function splitTextLine(line: number, before: string, after: string): void {
  const view = currentView
  if (!view) return
  const doc = view.state.doc
  if (line < 1 || line > doc.lines) return
  const l = doc.line(line)
  const i = l.text.indexOf(':')
  if (i < 0) return
  const head = l.text.slice(0, i + 1)
  const one = (s: string): string => s.replace(/\s*[\r\n]+\s*/g, ' ').trim()
  const a = one(before)
  const b = one(after)
  view.dispatch({
    changes: {
      from: l.from + i + 1,
      to: l.to,
      insert: (a === '' ? '' : ' ' + a) + '\n' + head + (b === '' ? '' : ' ' + b)
    },
    userEvent: 'input.cell'
  })
}

/** 내용이 빈 text 줄을 통째로 지운다. 지웠으면 true. */
export function deleteEmptyTextLine(line: number): boolean {
  const view = currentView
  if (!view) return false
  const doc = view.state.doc
  if (line < 1 || line > doc.lines) return false
  const l = doc.line(line)
  if (!/^\s*text[^:]*:\s*$/.test(l.text)) return false
  const from = line > 1 ? l.from - 1 : l.from
  const to = line > 1 ? l.to : Math.min(l.to + 1, doc.length)
  view.dispatch({ changes: { from, to }, userEvent: 'delete.cell' })
  return true
}

/** 빈 칸에 글자를 쓴다. afterLine(격자 마지막 칸의 글자 줄) 뒤에 col= 줄을 새로 끼운다. */
export function addCellText(
  afterLine: number,
  r: number,
  c: number,
  rs: number,
  cs: number,
  text: string
): void {
  const view = currentView
  if (!view) return
  const doc = view.state.doc
  if (afterLine < 1 || afterLine > doc.lines) return
  let ref = doc.line(afterLine).text
  for (let n = afterLine; n >= 1; n--) {
    if (/^\s*(?:col|row)=/.test(doc.line(n).text)) {
      ref = doc.line(n).text
      break
    }
  }
  const base = /^\s*/.exec(ref)?.[0] ?? ''
  const cols = cs > 1 ? `col=${c + 1}-${c + cs}` : `col=${c + 1}`
  const rows = rs > 1 ? `row=${r + 1}-${r + rs}` : `row=${r + 1}`
  const lines = [`${base}${cols} ${rows} :`, ...cellBody(ref, text)]
  view.dispatch({
    changes: { from: doc.line(afterLine).to, insert: '\n' + lines.join('\n') },
    userEvent: 'input.cell'
  })
}

const markdownHighlight = HighlightStyle.define([
  { tag: tags.processingInstruction, color: 'var(--color-text-tertiary)' },
  { tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', color: 'var(--color-text)' },
  { tag: tags.strong, fontWeight: '700', color: 'var(--color-text)' },
  { tag: tags.emphasis, fontStyle: 'italic', color: 'var(--color-text)' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--color-text-secondary)' },
  { tag: tags.monospace, fontFamily: 'var(--font-editor)', color: 'var(--color-syntax-code)' },
  { tag: tags.quote, color: 'var(--color-text-secondary)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--color-text)' },
  { tag: tags.contentSeparator, color: 'var(--color-border-strong)' }
])

const markDeco = (color: string): Decoration =>
  Decoration.mark({ attributes: { style: `color: ${color}` } })

const symbolDecos: Record<string, Decoration> = {
  HeaderMark: markDeco('var(--color-syntax-heading)'),
  QuoteMark: markDeco('var(--color-syntax-mark)'),
  BulletMark: markDeco('var(--color-syntax-bullet)'),
  OrderedMark: markDeco('var(--color-accent)'),
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

const toolbarEffect = StateEffect.define<boolean>()

const toolbarField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(toolbarEffect)) return e.value
    if (tr.docChanged || tr.selection) return false
    return value
  }
})

function toggleWrap(view: EditorView, mark: string): void {
  const { from, to } = view.state.selection.main
  const doc = view.state.doc
  const before = doc.sliceString(Math.max(0, from - mark.length), from)
  const after = doc.sliceString(to, Math.min(doc.length, to + mark.length))
  if (before === mark && after === mark) {
    view.dispatch({
      changes: [
        { from: from - mark.length, to: from },
        { from: to, to: to + mark.length }
      ],
      selection: { anchor: from - mark.length, head: to - mark.length },
      effects: toolbarEffect.of(true)
    })
  } else {
    view.dispatch({
      changes: [
        { from, insert: mark },
        { from: to, insert: mark }
      ],
      selection: { anchor: from + mark.length, head: to + mark.length },
      effects: toolbarEffect.of(true)
    })
  }
}

function wrapLink(view: EditorView): void {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: [
      { from, insert: '[' },
      { from: to, insert: '](url)' }
    ],
    selection: { anchor: to + 3, head: to + 6 }
  })
}

const toolbarButtons: { label: string; title: string; run: (view: EditorView) => void }[] = [
  { label: 'B', title: '굵게', run: (v) => toggleWrap(v, '**') },
  { label: 'I', title: '기울임', run: (v) => toggleWrap(v, '*') },
  { label: 'S', title: '취소선', run: (v) => toggleWrap(v, '~~') },
  { label: '</>', title: '코드', run: (v) => toggleWrap(v, '`') },
  { label: '링크', title: '링크', run: wrapLink }
]

function createToolbar(view: EditorView): TooltipView {
  const dom = document.createElement('div')
  dom.className = 'sel-toolbar'
  for (const b of toolbarButtons) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.title = b.title
    btn.textContent = b.label
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      b.run(view)
    })
    dom.appendChild(btn)
  }
  return { dom }
}

const toolbarTooltip = showTooltip.compute([toolbarField, 'selection'], (state): Tooltip | null => {
  const sel = state.selection.main
  if (!state.field(toolbarField) || sel.empty) return null
  return { pos: sel.from, above: true, strictSide: true, arrow: false, create: createToolbar }
})

function selectionToolbar(): Extension {
  return [
    toolbarField,
    toolbarTooltip,
    EditorView.domEventHandlers({
      mouseup(event, view) {
        if (event.button !== 0) return false
        setTimeout(() => {
          if (getCM(view)?.state.vim) return
          if (view.state.selection.main.empty) return
          view.dispatch({ effects: toolbarEffect.of(true) })
        }, 0)
        return false
      }
    })
  ]
}

type ChangeKind = 'add' | 'mod' | 'del'

class ChangeMarker extends GutterMarker {
  constructor(readonly kind: ChangeKind) {
    super()
  }
  eq(other: GutterMarker): boolean {
    return other instanceof ChangeMarker && other.kind === this.kind
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = `cm-change-marker cm-change-${this.kind}`
    return el
  }
}

const changeMarkers: Record<ChangeKind, ChangeMarker> = {
  add: new ChangeMarker('add'),
  mod: new ChangeMarker('mod'),
  del: new ChangeMarker('del')
}

const setChangeMarkers = StateEffect.define<RangeSet<GutterMarker>>()

const changeMarkersField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setChangeMarkers)) return e.value
    return value.map(tr.changes)
  }
})

function computeChangeMarkers(base: string, doc: Text): RangeSet<GutterMarker> {
  const rows = diffToRows(base, doc.toString())
  const kinds = new Map<number, ChangeKind>()
  let line = 1
  for (const row of rows) {
    if (row.rightType === 'empty') {
      const target = Math.min(line, doc.lines)
      if (!kinds.has(target)) kinds.set(target, 'del')
    } else {
      if (row.rightType === 'add') kinds.set(line, row.leftType === 'remove' ? 'mod' : 'add')
      line++
    }
  }
  const builder = new RangeSetBuilder<GutterMarker>()
  for (const [n, kind] of [...kinds].sort((a, b) => a[0] - b[0])) {
    const pos = doc.line(n).from
    builder.add(pos, pos, changeMarkers[kind])
  }
  return builder.finish()
}

function changeGutter(base: string, onClick: () => void): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      timer: ReturnType<typeof setTimeout> | null = null
      constructor(view: EditorView) {
        this.schedule(view, 0)
      }
      update(u: ViewUpdate): void {
        if (u.docChanged) this.schedule(u.view, 300)
      }
      schedule(view: EditorView, delay: number): void {
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => {
          view.dispatch({ effects: setChangeMarkers.of(computeChangeMarkers(base, view.state.doc)) })
        }, delay)
      }
      destroy(): void {
        if (this.timer) clearTimeout(this.timer)
      }
    }
  )
  return [
    changeMarkersField,
    plugin,
    gutter({
      class: 'cm-change-gutter',
      markers: (view) => view.state.field(changeMarkersField),
      domEventHandlers: {
        mousedown: () => {
          onClick()
          return true
        }
      }
    })
  ]
}

class FoldChevron extends GutterMarker {
  constructor(readonly folded: boolean) {
    super()
  }
  eq(other: GutterMarker): boolean {
    return other instanceof FoldChevron && other.folded === this.folded
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = `cm-snote-chevron${this.folded ? ' folded' : ''}`
    el.innerHTML = chevronSvg
    return el
  }
}

const chevronOpen = new FoldChevron(false)
const chevronFolded = new FoldChevron(true)

function foldedAt(state: EditorState, from: number, to: number): { from: number; to: number } | null {
  let found = null as { from: number; to: number } | null
  foldedRanges(state).between(from, to, (a, b) => {
    if (a >= from && a <= to) {
      found = { from: a, to: b }
      return false
    }
    return undefined
  })
  return found
}

function foldChevronGutter(): Extension {
  return gutter({
    class: 'cm-snote-fold',
    lineMarker(view, line) {
      if (foldedAt(view.state, line.from, line.to)) return chevronFolded
      return foldable(view.state, line.from, line.to) ? chevronOpen : null
    },
    lineMarkerChange: (u) =>
      u.transactions.some((tr) => tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect))),
    initialSpacer: () => chevronOpen,
    domEventHandlers: {
      mousedown(view, line) {
        const folded = foldedAt(view.state, line.from, line.to)
        if (folded) {
          view.dispatch({ effects: unfoldEffect.of(folded) })
          return true
        }
        const range = foldable(view.state, line.from, line.to)
        if (range) view.dispatch({ effects: foldEffect.of(range) })
        return true
      }
    }
  })
}

function computeRenumberChanges(
  state: EditorState
): { from: number; to: number; insert: string }[] | null {
  const pos = state.selection.main.head
  const doc = state.doc
  const line = doc.lineAt(pos)
  const match = line.text.match(/^(\s*)(\d+)([.)])\s/)
  if (!match) return null
  const indent = match[1]

  let startLine = line.number
  while (startLine > 1) {
    const prev = doc.line(startLine - 1)
    const m = prev.text.match(/^(\s*)(\d+)([.)])\s/)
    if (!m || m[1] !== indent) break
    startLine--
  }
  let endLine = line.number
  while (endLine < doc.lines) {
    const next = doc.line(endLine + 1)
    const m = next.text.match(/^(\s*)(\d+)([.)])\s/)
    if (!m || m[1] !== indent) break
    endLine++
  }

  const first = doc.line(startLine).text.match(/^(\s*)(\d+)([.)])\s/)
  if (!first) return null
  let expected = parseInt(first[2], 10)
  const changes: { from: number; to: number; insert: string }[] = []
  for (let n = startLine; n <= endLine; n++) {
    const l = doc.line(n)
    const m = l.text.match(/^(\s*)(\d+)([.)])\s/)
    if (!m) continue
    const numStr = String(expected)
    if (m[2] !== numStr) {
      const from = l.from + m[1].length
      changes.push({ from, to: from + m[2].length, insert: numStr })
    }
    expected++
  }
  return changes.length > 0 ? changes : null
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
  let lastVimMode = ''
  return [
    ViewPlugin.fromClass(
      class {
        constructor(view: EditorView) {
          this.sync(view)
        }
        update(u: ViewUpdate): void {
          this.sync(u.view)
        }
        sync(view: EditorView): void {
          view.requestMeasure({
            read: () => {
              const sy = parseFloat(getComputedStyle(document.body).zoom) || 1
              const lineHs = view.defaultLineHeight
              const lineH = lineHs / sy
              const head = view.state.selection.main.head
              const c = view.coordsAtPos(head)
              const node = view.domAtPos(head).node
              const el = (node.nodeType === 1 ? (node as Element) : node.parentElement)?.closest('.cm-line')
              let topS = 0
              let chS = lineHs
              if (c && el) {
                const lr = el.getBoundingClientRect()
                topS = Math.max(0, ((((c.top - lr.top) % lineHs) + lineHs) % lineHs))
                chS = c.bottom - c.top
              }
              return { lineHs, lineH, topS, chS, sy }
            },
            write: ({ lineHs, lineH, topS, chS, sy }) => {
              const s = view.dom.style
              s.setProperty('--cm-line-hs', `${lineHs}px`)
              s.setProperty('--cm-cur-tops', `${topS}px`)
              s.setProperty('--cm-line-h', `${lineH}px`)
              s.setProperty('--cm-cur-top', `${topS / sy}px`)
              s.setProperty('--cm-cur-h', `${chS / sy}px`)
            }
          })
        }
      }
    ),
    vimCompartment.of(vimModeInitial ? [vim()] : []),
    changeGutter(baseContent, onChangeClick),
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
              changes: { from: pos, insert: ' '},
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
    mdToolbar,
    EditorView.domEventHandlers({
      keydown: (e, view) => {
        const vs = getCM(view)?.state.vim
        if (vs && !vs.insertMode && (e.key === 'Process' || e.isComposing)) {
          const saved = view.state.selection
          imeGuardUntil = Date.now() + 200
          setTimeout(() => {
            if (view.state.selection.eq(saved)) {
              view.dispatch({ selection: saved, annotations: imeRestore.of(true) })
            }
          }, 120)
          e.preventDefault()
          return true
        }
        return false
      },
      beforeinput: (e, view) => {
        const vs = getCM(view)?.state.vim
        if (
          vs && 
          !vs.insertMode && 
          (e.inputType === 'deleteContentBackward' || 
            e.inputType === 'deleteCompositionText' ||
            e.inputType === 'insertText' ||
            e.inputType === 'insertCompositionText') 
        ) {
          e.preventDefault()
          return true
        }
        return false
      },
    }),
    EditorState.transactionFilter.of((tr) =>
      (tr.docChanged || tr.selection) &&
      Date.now() < imeGuardUntil &&
      !tr.annotation(imeRestore)
        ? []
        : tr
    ),
    markdownLang.language.data.of({ autocomplete: wikilinkCompletionSource(getNoteIndex) }),
    markdownLang.language.data.of({ autocomplete: templateCompletionSource }),
    editingAssist(),
    EditorState.transactionFilter.of((tr) => {
      if (!tr.docChanged || !tr.isUserEvent('delete')) return tr
      const renumber = computeRenumberChanges(tr.state)
      if (!renumber) return tr
      const combined = tr.changes.compose(ChangeSet.of(renumber, tr.changes.newLength))
      return { changes: combined }
    }),
    EditorState.transactionFilter.of((tr) => {
      if (!tr.selection || !tr.isUserEvent('select.pointer')) return tr
      ;(globalThis as { __vimPointerSelect?: boolean }).__vimPointerSelect = true
      const vimState = currentView ? getCM(currentView)?.state.vim : null
      if (!vimState || vimState.insertMode) return tr
      const sel = tr.newSelection.main
      if (!sel.empty) return tr
      const line = tr.newDoc.lineAt(sel.head)
      if (line.length > 0 && sel.head === line.to) {
        return [tr, { selection: { anchor: sel.head - 1 } }]
      }
      return tr
    }),
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
      },
      mousedown(event, view) {
        const vimState = getCM(view)?.state.vim
        if (!vimState || getVimMouse()) return false
        event.preventDefault()
        view.focus()
        return true
      },
      keydown() {
        ;(globalThis as { __vimPointerSelect?: boolean }).__vimPointerSelect = false
        return false
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
        lineHeight: 'var(--editor-line-height)',
        caretColor: 'var(--color-accent)',
        paddingTop: '0px',
        paddingBottom: '0px',
      },
      '.cm-cursor, .cm-cursor-primary': {
        borderLeftColor: 'var(--color-text)',
        borderLeftWidth: '2px'
      },
      '&:not(.cm-focused) .cm-vimCursorLayer': {
        display: 'none !important'
      },
      '.cm-gutters': {
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text-tertiary)',
        border: 'none',
        borderRight: '1px solid var(--color-border)',
        fontSize: '0.9em'
      },
      '.cm-lineNumbers .cm-gutterElement': {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end'
      },
      '.cm-gutters > .cm-gutter.cm-foldGutter': { display: 'none !important' },
      '.cm-snote-fold': { minWidth: '16px' },
      '.cm-snote-fold .cm-gutterElement': {
        padding: '0',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        cursor: 'pointer'
      },
      '.cm-snote-chevron': {
        display: 'flex',
        alignItems: 'center',
        height: 'calc(1em * var(--editor-line-height))',
        color: 'var(--color-text-tertiary)'
      },
      '.cm-snote-chevron:hover': { color: 'var(--color-text)' },
      '.cm-snote-chevron svg': { width: '12px', height: '12px', transform: 'rotate(90deg)' },
      '.cm-snote-chevron.folded svg': { transform: 'none' },
      '.cm-change-gutter': { minWidth: '6px' },
      '.cm-change-gutter .cm-gutterElement': { padding: '0', cursor: 'pointer' },
      '.cm-change-marker': { width: '3px', height: '100%', marginLeft: '0', borderRadius: '1px' },
      '.cm-change-add': { backgroundColor: 'var(--color-diff-add-text)' },
      '.cm-change-mod': {
        backgroundColor: 'color-mix(in srgb, var(--color-diff-add-text) 55%, transparent)'
      },
      '.cm-change-del': {
        height: '2px',
        width: '6px',
        marginTop: '-1px',
        backgroundColor: 'var(--color-diff-remove-text)'
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
      currentView = view
      Vim.defineEx('write', 'w', () => onSaveRef.current?.())

      const handleScroll = (): void => {
        const scroller = view.scrollDOM
        const max = scroller.scrollHeight - scroller.clientHeight
        onScrollRatioRef.current?.(max > 0 ? scroller.scrollTop / max : 0)
      }
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

      return (): void => {
        view.scrollDOM.removeEventListener('scroll', handleScroll)
        currentView = null
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
