import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { Prec, type Extension, type Range as CmRange } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
  keymap
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

const FENCE_CLOSE = /^\s*(?:`{3,}|~{3,})\s*$/

const ICON_COPY =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/></svg>'
const ICON_CHECK =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>'

const imp = (v: string): string => `${v} !important`

export const codeHighlight = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: [
        t.keyword,
        t.operatorKeyword,
        t.controlKeyword,
        t.definitionKeyword,
        t.moduleKeyword,
        t.modifier
      ],
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
  eq(o: WidgetType): boolean {
    return o instanceof BarWidget
  }
  toDOM(view: EditorView): HTMLElement {
    const bar = document.createElement('span')
    bar.className = 'cm-codebar'

    const copy = document.createElement('button')
    copy.type = 'button'
    copy.className = 'cm-codebar-copy'
    copy.title = '복사'
    copy.innerHTML = ICON_COPY
    copy.addEventListener('mousedown', (e) => e.preventDefault())
    copy.addEventListener('click', () => {
      void navigator.clipboard.writeText(blockText(view, view.posAtDOM(bar)))
      copy.innerHTML = ICON_CHECK
      setTimeout(() => {
        copy.innerHTML = ICON_COPY
      }, 1200)
    })

    bar.append(copy)
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
          decos.push(Decoration.widget({ widget: new BarWidget(), side: 1 }).range(first.to))
        }
        return false
      }
    })
  }
  return Decoration.set(decos, true)
}

const FENCE_LINE = /^(\s*)(`{3,}|~{3,})[ \t]*\S*[ \t]*$/

const fenceEnter = Prec.high(
  keymap.of([
    {
      key: 'Enter',
      run: (view) => {
        const state = view.state
        const sel = state.selection.main
        if (!sel.empty) return false
        const doc = state.doc
        const line = doc.lineAt(sel.head)
        const m = FENCE_LINE.exec(line.text)
        if (!m || sel.head !== line.to) return false

        let node = syntaxTree(state).resolveInner(line.to, -1)
        while (node.name !== 'FencedCode' && node.parent) node = node.parent
        if (node.name !== 'FencedCode' || doc.lineAt(node.from).number !== line.number) return false
        const last = doc.lineAt(node.to)
        if (last.number !== line.number && FENCE_CLOSE.test(last.text)) return false

        view.dispatch({
          changes: { from: line.to, insert: '\n' + m[1] + '\n' + m[1] + m[2] },
          selection: { anchor: line.to + 1 + m[1].length },
          userEvent: 'input'
        })
        return true
      }
    }
  ])
)

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

export const codeBlocks: Extension = [codeBlockPlugin, codeHighlight, fenceEnter]
