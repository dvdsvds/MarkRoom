import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { Prec, RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'

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

export const markdownColors: Extension = [
  syntaxHighlighting(markdownHighlight),
  Prec.highest(markdownSymbolColors)
]