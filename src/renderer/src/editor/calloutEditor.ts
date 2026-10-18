import { RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { CALLOUT_COLOR_HEX, CALLOUT_TYPES, findCalloutType } from '../utils/callout'

// `> [!warning]-` 처럼 인용문 줄 맨 앞의 콜아웃 표시
const MARKER_RE = /^(\s{0,3}(?:>\s?)+)(\[!([^\]\s]+)\][+-]?)/

const decoCache = new Map<string, Decoration>()
function markerDeco(color: string): Decoration {
  let deco = decoCache.get(color)
  if (!deco) {
    deco = Decoration.mark({ attributes: { style: `color: ${color}; font-weight: 600` } })
    decoCache.set(color, deco)
  }
  return deco
}

function buildDecos(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      const m = MARKER_RE.exec(line.text)
      if (m) {
        const type = findCalloutType(m[3]) ?? CALLOUT_TYPES[0]
        const start = line.from + m[1].length
        builder.add(start, start + m[2].length, markerDeco(CALLOUT_COLOR_HEX[type.color]))
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

/** 원문의 `[!종류]` 부분만 그 종류 색으로 칠한다. 상자는 미리보기에서만 그린다. */
export const calloutMarkerColors: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecos(view)
    }
    update(u: ViewUpdate): void {
      if (u.docChanged || u.viewportChanged) this.decorations = buildDecos(u.view)
    }
  },
  { decorations: (v) => v.decorations }
)

/** 인용문 줄에서 `[!` 를 치면 콜아웃 종류를 추천한다. */
export function calloutCompletionSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)
  const m = /^\s{0,3}(?:>\s?)+\[!([^\]\s]*)$/.exec(before)
  if (!m) return null
  const from = context.pos - m[1].length
  // 괄호 자동 닫기로 `]`가 이미 뒤에 있으면 다시 넣지 않는다
  const hasClose = line.text[context.pos - line.from] === ']'
  return {
    from,
    options: CALLOUT_TYPES.map((t, i) => ({
      label: t.type,
      detail: t.title,
      type: 'keyword',
      boost: 99 - i,
      apply: (view: EditorView, _c: unknown, applyFrom: number, applyTo: number) => {
        view.dispatch({
          changes: { from: applyFrom, to: hasClose ? applyTo + 1 : applyTo, insert: `${t.type}] ` },
          selection: { anchor: applyFrom + t.type.length + 2 }
        })
      }
    })),
    validFor: /^[^\]\s]*$/
  }
}
