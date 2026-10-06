import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import type { Extension, Range as CmRange } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

const FENCE_OPEN = /^(\s*(?:`{3,}|~{3,})[ \t]*)(\S*)/
const FENCE_CLOSE = /^\s*(?:`{3,}|~{3,})\s*$/

const LANGS: { id: string; label: string; runnable?: boolean }[] = [
  { id: '', label: '언어 없음' },
  { id: 'js', label: 'js', runnable: true },
  { id: 'python', label: 'python', runnable: true },
  { id: 'ts', label: 'ts' },
  { id: 'json', label: 'json' },
  { id: 'css', label: 'css' },
  { id: 'html', label: 'html' },
  { id: 'bash', label: 'bash' },
  { id: 'sql', label: 'sql' },
  { id: 'md', label: 'md' },
  { id: 'csv', label: 'csv' },
  { id: 'mermaid', label: 'mermaid' }
]

const ICON_COPY =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>'
const ICON_CHECK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>'

const imp = (v: string): string => `${v} !important`

export const codeHighlight = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.modifier],
      color: imp('var(--code-keyword)')
    },
    { tag: [t.string, t.special(t.string), t.regexp], color: imp('var(--code-string)') },
    { tag: [t.number, t.bool, t.null, t.atom], color: imp('var(--code-number)') },
    { tag: t.comment, color: imp('var(--code-comment)'), fontStyle: 'italic' },
    { tag: t.function(t.variableName), color: imp('var(--code-function)') },
    { tag: t.function(t.propertyName), color: imp('var(--code-function)') },
    { tag: [t.typeName, t.className, t.namespace], color: imp('var(--code-type)') },
    { tag: [t.definition(t.variableName), t.variableName], color: imp('var(--code-variable)') },
    { tag: t.propertyName, color: imp('var(--code-property)') },
    { tag: [t.operator, t.punctuation], color: imp('var(--code-operator)') },
    { tag: [t.tagName, t.attributeName], color: imp('var(--code-keyword)') }
  ])
)

let menuEl: HTMLElement | null = null
let stopListening: (() => void) | null = null

function closeMenu(): void {
  stopListening?.()
  stopListening = null
  menuEl?.remove()
  menuEl = null
}

function fenceInfo(view: EditorView, pos: number): { from: number; to: number } | null {
  const line = view.state.doc.lineAt(pos)
  const m = FENCE_OPEN.exec(line.text)
  if (!m) return null
  const from = line.from + m[1].length
  return { from, to: from + m[2].length }
}

function openMenu(view: EditorView, anchor: HTMLElement, pos: number): void {
  closeMenu()
  const info = fenceInfo(view, pos)
  if (!info) return
  const current = view.state.doc.sliceString(info.from, info.to)

  const r = anchor.getBoundingClientRect()
  const menu = document.createElement('div')
  menu.className = 'cm-lang-menu'
  menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 168))}px`
  menu.style.top = `${Math.max(8, Math.min(r.bottom + 4, window.innerHeight - 400))}px`

  const apply = (id: string): void => {
    view.dispatch({ changes: { from: info.from, to: info.to, insert: id }, userEvent: 'input.lang' })
    closeMenu()
    view.focus()
  }

  for (const l of LANGS) {
    const item = document.createElement('button')
    item.type = 'button'
    item.className = 'cm-lang-item' + (l.id === current ? ' active' : '')
    item.textContent = l.label
    item.addEventListener('mousedown', (e) => e.preventDefault())
    item.addEventListener('click', () => apply(l.id))
    menu.appendChild(item)
  }

  const input = document.createElement('input')
  input.className = 'cm-lang-input'
  input.placeholder = '직접 입력'
  input.spellcheck = false
  input.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      const v = input.value.trim().replace(/[^A-Za-z0-9_+#.-]/g, '')
      if (v) apply(v)
    } else if (e.key === 'Escape') {
      closeMenu()
      view.focus()
    }
  })
  menu.appendChild(input)

  document.body.appendChild(menu)
  menuEl = menu
  const onDown = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node)) closeMenu()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeMenu()
  }
  document.addEventListener('mousedown', onDown, true)
  document.addEventListener('keydown', onKey, true)
  stopListening = () => {
    document.removeEventListener('mousedown', onDown, true)
    document.removeEventListener('keydown', onKey, true)
  }
}

function blockText(view: EditorView, pos: number): string {
  const doc = view.state.doc
  const first = doc.lineAt(pos)
  const out: string[] = []
  for (let n = first.number + 1; n <= doc.lines; n++) {
    const text = doc.line(n).text
    if (FENCE_CLOSE.test(text)) break
    out.push(text)
  }
  return out.join('\n')
}

class BarWidget extends WidgetType {
  constructor(readonly lang: string) {
    super()
  }
  eq(o: BarWidget): boolean {
    return o.lang === this.lang
  }
  toDOM(view: EditorView): HTMLElement {
    const bar = document.createElement('span')
    bar.className = 'cm-codebar'

    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'cm-codebar-chip'
    chip.textContent = this.lang || '언어 없음'

    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'cm-codebar-copy'
    copy.title = '복사'
    copy.innerHTML = ICON_COPY

    for (const b of [chip, copy]) b.addEventListener('mousedown', (e) => e.preventDefault())
    chip.addEventListener('click', () => openMenu(view, chip, view.posAtDOM(bar)))
    copy.addEventListener('click', () => {
      void navigator.clipboard.writeText(blockText(view, view.posAtDOM(bar)))
      copy.innerHTML = ICON_CHECK
      setTimeout(() => {
        copy.innerHTML = ICON_COPY
      }, 1200)
    })

    bar.append(chip, copy)
    return bar
  }
  ignoreEvent(): boolean {
    return true
  }
}

function build(view: EditorView): DecorationSet {
  const decos: CmRange<Decoration>[] = []
  const doc = view.state.doc
  const seen = new Set<number>()
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'FencedCode') return
        const first = doc.lineAt(node.from)
        const last = doc.lineAt(node.to)
        const startN = Math.max(first.number, doc.lineAt(from).number)
        const endN = Math.min(last.number, doc.lineAt(to).number)
        for (let n = startN; n <= endN; n++) {
          const line = doc.line(n)
          let cls = 'cm-codeblock'
          if (n === first.number) cls += ' cm-codeblock-first cm-codeblock-fence'
          if (n === last.number) cls += ' cm-codeblock-last'
          if (n === last.number && n !== first.number && FENCE_CLOSE.test(line.text)) {
            cls += ' cm-codeblock-fence'
          }
          decos.push(Decoration.line({ class: cls }).range(line.from))
        }
        if (!seen.has(first.number)) {
          seen.add(first.number)
          const m = FENCE_OPEN.exec(first.text)
          decos.push(
            Decoration.widget({ widget: new BarWidget(m ? m[2] : ''), side: 1 }).range(first.to)
          )
          if (m && m[2]) {
            const infoFrom = first.from + m[1].length
            decos.push(Decoration.replace({}).range(infoFrom, infoFrom + m[2].length))
          }
        }
        return false
      }
    })
  }
  return Decoration.set(decos, true)
}

const codeBlockPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = build(view)
    }
    update(u: ViewUpdate): void {
      if (u.docChanged || u.viewportChanged || syntaxTree(u.startState) !== syntaxTree(u.state)) {
        this.decorations = build(u.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)

export const codeBlocks: Extension = [codeBlockPlugin, codeHighlight]