import type { Range as CmRange } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import { COLOR_NAMES, HEX_PATTERN, parseColorHead } from '../markdown/colorSyntax'
import { openColorPopover } from './colorPopover'

const NAMES = COLOR_NAMES.join('|')
const HEAD_RE = /\{([^{}|\n]+)\|/g
const TOKEN_RE = new RegExp(`^(?:${NAMES}|${HEX_PATTERN})(?=[|,\\s])`)

const cssColor = (token: string): string => (token.startsWith('#') ? token : `var(--c-${token})`)

function toHex6(token: string): string {
  if (/^#[0-9a-f]{6}$/i.test(token)) return token.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(token)) {
    return (
      '#' +
      token
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
        .toLowerCase()
    )
  }
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--c-${token}`).trim()
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '#000000'
}

function openPicker(view: EditorView, dom: HTMLElement): void {
  const pos = view.posAtDOM(dom)
  const line = view.state.doc.lineAt(pos)
  const m = TOKEN_RE.exec(line.text.slice(pos - line.from))
  if (!m) return
  const from = pos
  let to = pos + m[0].length

  openColorPopover(dom, toHex6(m[0]), (hex) => {
    view.dispatch({ changes: { from, to, insert: hex }, userEvent: 'input.color' })
    to = from + hex.length
  })
}

class SwatchWidget extends WidgetType {
  constructor(readonly token: string) {
    super()
  }
  eq(other: SwatchWidget): boolean {
    return other.token === this.token
  }
  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-color-swatch'
    el.style.setProperty('--sw', cssColor(this.token))
    el.addEventListener('mousedown', (e) => e.preventDefault())
    el.addEventListener('click', () => openPicker(view, el))
    return el
  }
  ignoreEvent(): boolean {
    return true
  }
}

function build(view: EditorView): DecorationSet {
  const ranges: CmRange<Decoration>[] = []
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    HEAD_RE.lastIndex = 0
    for (let m = HEAD_RE.exec(text); m; m = HEAD_RE.exec(text)) {
      const head = m[1]
      if (!parseColorHead(head)) continue
      const headStart = from + m.index + 1
      let off = 0
      for (const part of head.split(',')) {
        let start = off + (part.length - part.trimStart().length)
        let token = part.trim()
        if (token.startsWith('bg:')) {
          const rest = token.slice(3)
          start += 3 + (rest.length - rest.trimStart().length)
          token = rest.trim()
        }
        ranges.push(
          Decoration.widget({ widget: new SwatchWidget(token), side: -1 }).range(headStart + start)
        )
        off += part.length + 1
      }
    }
  }
  return Decoration.set(ranges, true)
}

export const colorSwatch = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate): void {
      if (u.docChanged || u.viewportChanged) this.decorations = build(u.view)
    }
  },
  { decorations: (v) => v.decorations }
)
