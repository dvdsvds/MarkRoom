import {
  acceptCompletion,
  autocompletion,
  closeCompletion,
  completionStatus,
  moveCompletionSelection,
  pickedCompletion,
  selectedCompletion,
  startCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import { Prec, type Extension, type Text } from '@codemirror/state'
import { keymap, type EditorView } from '@codemirror/view'
import { fontCandidates, loadSystemFonts } from '../utils/systemFonts'

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']
const OPENER = /^(template|box|table|grid=\d{1,2}(?:\s+(?:frame|widths)=\S+)*)\s*\[$/
const COL_DEF = /^\s*(?:col|row)=\d/
const indentOf = (s: string): number => s.length - s.trimStart().length

type LineKind = 'page' | 'text' | 'col' | 'grid' | null

/** 이 줄을 감싼 가장 안쪽 블록. template 안이 아니면 null. */
function enclosing(doc: Text, lineNo: number): 'template' | 'box' | 'table' | 'grid' | null {
  let depth = 0
  let innermost: 'template' | 'box' | 'table' | 'grid' | null = null
  for (let n = lineNo - 1, steps = 0; n >= 1 && steps < 600; n--, steps++) {
    const t = doc.line(n).text.trim()
    if (t === ']') {
      depth++
      continue
    }
    const m = OPENER.exec(t)
    if (!m) continue
    if (depth > 0) {
      depth--
      continue
    }
    const kind = m[1].startsWith('grid') ? 'grid' : (m[1] as 'template' | 'box' | 'table')
    if (innermost === null) innermost = kind
    if (kind === 'template') return innermost
  }
  return null
}

function inCellText(doc: Text, lineNo: number, ci: number): boolean {
  if (ci === 0) return false
  for (let n = lineNo - 1, steps = 0; n >= 1 && steps < 80; n--, steps++) {
    const t = doc.line(n).text
    if (t.trim() === '') continue
    if (indentOf(t) < ci) return COL_DEF.test(t)
  }
  return false
}

/** Tab으로 고르면 insert가 들어가고, space면 뒤에 공백이 붙고, restart면 값 목록이 바로 이어서 뜬다. */
function make(
  label: string,
  insert: string,
  type: string,
  o: { space?: boolean; restart?: boolean } = {}
): Completion {
  return {
    label,
    type,
    apply: (view: EditorView, completion: Completion, from: number, to: number): void => {
      const next = view.state.doc.sliceString(to, to + 1)
      const sp = o.space && !/^[ \t]/.test(next) ? ' ' : ''
      const text = insert + sp
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        annotations: pickedCompletion.of(completion),
        userEvent: 'input.complete'
      })
      if (o.restart) setTimeout(() => startCompletion(view), 0)
    }
  }
}

const FLAGS = [
  'left',
  'center',
  'right',
  'justify',
  'distribute',
  'top',
  'middle',
  'bottom',
  'bold',
  'italic',
  'underline',
  'strike',
  'vertical'
]
const TEXT_FLAGS = [
  'left',
  'center',
  'right',
  'justify',
  'distribute',
  'bold',
  'italic',
  'underline',
  'strike'
]
const RESTART = new Set([
  'ff',
  'fc',
  'bg',
  'border',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-color',
  'line'
])

const flagItems = (names: string[]): Completion[] =>
  names.map((n) => make(n, n, 'snote-opt', { space: true }))
const valueItems = (names: string[]): Completion[] =>
  names.map((n) => make(`${n}=`, `${n}=`, 'snote-opt', { restart: RESTART.has(n) }))

const COL_ITEMS = [
  ...flagItems(FLAGS),
  ...valueItems([
    'ff',
    'fs',
    'fc',
    'bg',
    'h',
    'p',
    'ls',
    'lh',
    'border',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
    'border-color',
    'line'
  ])
]
const PAGE_ITEMS = [
  ...flagItems(FLAGS),
  ...valueItems([
    'ff',
    'fs',
    'fc',
    'bg',
    'p',
    'ls',
    'lh',
    'border',
    'border-top',
    'border-right',
    'border-bottom',
    'border-left',
    'border-color',
    'line'
  ])
]
const TEXT_ITEMS = [...flagItems(TEXT_FLAGS), ...valueItems(['ff', 'fs', 'fc', 'bg', 'ls', 'lh'])]
const NODE_ITEMS = [
  make('page', 'page A4', 'snote-kw', { space: true }),
  make('grid=', 'grid=', 'snote-kw'),
  make('text', 'text', 'snote-kw', { space: true }),
  make('line', 'line', 'snote-kw', { space: true }),
  make('space', 'space', 'snote-kw', { space: true }),
  make('box', 'box [', 'snote-kw'),
  make('table', 'table [', 'snote-kw')
]
const GRID_ITEMS = [make('col=', 'col=', 'snote-kw'), make('row=', 'row=', 'snote-kw')]
const COLOR_ITEMS = COLORS.map((c) => make(c, c, 'snote-color', { space: true }))
const LINE_ITEMS = ['solid', 'thick', 'double', 'dashed'].map((v) =>
  make(v, v, 'snote-opt', { space: true })
)
const FRAME_ITEMS = ['none', 'solid', 'thick', 'double', 'dashed'].map((v) =>
  make(v, v, 'snote-opt', { space: true })
)
const EDGE_ITEMS = ['none', 'solid', 'thick', 'double', 'dashed'].map((v) =>
  make(v, v, 'snote-opt', { space: true })
)
const BORDER_ITEMS = [
  make('none', 'none', 'snote-opt', { space: true }),
  make('all', 'all', 'snote-opt', { space: true }),
  ...['-left', '-right', '-top', '-bottom'].map((v) => make(v, v, 'snote-opt'))
]

const fontRank = new Map<string, number>()

async function fontItems(quoted: boolean): Promise<Completion[]> {
  const names = await loadSystemFonts()
  fontRank.clear()
  return names.map((name, i) => {
    fontRank.set(name, i)
    const safe = name.replace(/["\\]/g, '')
    return make(name, quoted ? `${safe}"` : `"${safe}"`, 'snote-font', { space: true })
  })
}

export async function templateCompletionSource(
  ctx: CompletionContext
): Promise<CompletionResult | null> {
  const { state, pos } = ctx
  const doc = state.doc
  const line = doc.lineAt(pos)
  const before = line.text.slice(0, pos - line.from)
  const kind = enclosing(doc, line.number)
  if (kind === null || kind === 'table') return null
  if (kind === 'grid' && inCellText(doc, line.number, indentOf(line.text))) return null

  const first = before.trimStart().split(/\s+/)[0] ?? ''
  let lineKind: LineKind = null
  if (/^page(=\d{1,3})?$/.test(first)) lineKind = 'page'
  else if (first === 'text') lineKind = 'text'
  else if (/^(col|row)=/.test(first)) lineKind = 'col'
  else if (/^grid=/.test(first)) lineKind = 'grid'

  const vm =
    /(?:^|\s)(ff|fc|bg|border-top|border-right|border-bottom|border-left|border-color|border|line|frame)=("[^"]*|[^\s"]*)$/.exec(
      before
    )
  if (vm) {
    const key = vm[1]
    const typed = vm[2]
    if (lineKind === null) return null
    if (key === 'frame' ? lineKind !== 'grid' : lineKind === 'grid') return null
    if (lineKind === 'text' && (key.startsWith('border') || key === 'line' || before.includes(':')))
      return null
    const valueStart = pos - typed.length
    if (key === 'ff') {
      const quoted = typed.startsWith('"')
      return {
        from: valueStart + (quoted ? 1 : 0),
        options: await fontItems(quoted),
        validFor: /^[^"]*$/
      }
    }
    if (key === 'border') {
      const seg = typed.split(',').pop() ?? ''
      return { from: pos - seg.length, options: BORDER_ITEMS, validFor: /^-?[a-z]*$/ }
    }
    const options =
      key === 'frame'
        ? FRAME_ITEMS
        : key === 'line'
          ? LINE_ITEMS
          : key.startsWith('border-') && key !== 'border-color'
            ? EDGE_ITEMS
            : COLOR_ITEMS
    return { from: valueStart, options, validFor: /^[a-z]*$/ }
  }

  const tokenBefore = /\S*$/.exec(before)?.[0] ?? ''
  if (tokenBefore.includes('=')) return null

  const wm = /[A-Za-z][A-Za-z-]*$/.exec(before)
  if (!wm && !ctx.explicit) return null
  const word = wm ? wm[0] : ''
  const from = pos - word.length
  const idx = before.length - word.length
  const prev = idx > 0 ? before[idx - 1] : ''
  if (prev !== '' && !/[\s:]/.test(prev)) return null

  const atStart = before.slice(0, idx).trim() === ''
  const hasColon = before.includes(':')
  let options: Completion[] | null = null
  if (atStart) options = kind === 'grid' ? GRID_ITEMS : NODE_ITEMS
  else if (lineKind === 'page') options = PAGE_ITEMS
  else if (lineKind === 'text') options = hasColon ? null : TEXT_ITEMS
  else if (lineKind === 'col') {
    options = hasColon
      ? COL_ITEMS
      : ['row=', 'col='].filter((x) => !before.includes(x)).map((x) => make(x, x, 'snote-kw'))
  } else if (lineKind === 'grid') {
    options = ['frame=', 'widths=']
      .filter((x) => !before.includes(x))
      .map((x) => make(x, x, 'snote-opt', { restart: x === 'frame=' }))
  }
  if (!options || options.length === 0) return null
  return { from, options, validFor: /^[A-Za-z-]*$/ }
}

export const templateCompletion: Extension = [
  autocompletion({
    defaultKeymap: false,
    tooltipClass: () => 'snote-ac',
    optionClass: (c) => (c.type === 'snote-font' ? 'snote-font-opt' : ''),
    compareCompletions: (a, b) =>
      a.type === 'snote-font' && b.type === 'snote-font'
        ? (fontRank.get(a.label) ?? 0) - (fontRank.get(b.label) ?? 0)
        : a.label.localeCompare(b.label),
    addToOptions: [
      {
        position: 30,
        render: (c) => {
          if (c.type === 'snote-color') {
            const s = document.createElement('span')
            s.className = 'snote-swatch'
            s.style.background = `var(--c-${c.label})`
            return s
          }
          if (c.type === 'snote-font') {
            const s = document.createElement('span')
            s.className = 'snote-font-prev'
            s.style.fontFamily = fontCandidates(c.label)
              .map((f) => `"${f}"`)
              .join(', ')
            s.textContent = c.label
            return s
          }
          return null
        }
      }
    ]
  }),
  Prec.highest(
    keymap.of([
      {
        key: 'Tab',
        run: (v) => (completionStatus(v.state) === 'active' ? acceptCompletion(v) : false)
      },
      {
        key: 'Enter',
        run: (v) => {
          if (completionStatus(v.state) !== 'active') return false
          const c = selectedCompletion(v.state)
          if (!c || (c.type ?? '').startsWith('snote-')) return false
          return acceptCompletion(v)
        }
      },
      { key: 'ArrowDown', run: moveCompletionSelection(true) },
      { key: 'ArrowUp', run: moveCompletionSelection(false) },
      { key: 'PageDown', run: moveCompletionSelection(true, 'page') },
      { key: 'PageUp', run: moveCompletionSelection(false, 'page') },
      { key: 'Escape', run: closeCompletion },
      { key: 'Ctrl-Space', run: startCompletion }
    ])
  )
]
