import { EditorSelection, type ChangeSpec, type EditorState, type SelectionRange } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { startCompletion } from '@codemirror/autocomplete'

/** 에디터 툴바가 쓰는 글 편집 명령들. 전부 선택(여러 개 가능)과 커서 둘 다에서 동작한다. */

const run = (view: EditorView, spec: Parameters<EditorView['dispatch']>[0]): void => {
  view.dispatch({ ...spec, scrollIntoView: true, userEvent: 'input.toolbar' })
  view.focus()
}

// ───────── 감싸기: 굵게·기울임·취소선·코드·수식 ─────────

const starsBefore = (s: EditorState, pos: number): number => {
  let n = 0
  while (pos - n > 0 && s.sliceDoc(pos - n - 1, pos - n) === '*') n++
  return n
}
const starsAfter = (s: EditorState, pos: number): number => {
  let n = 0
  while (pos + n < s.doc.length && s.sliceDoc(pos + n, pos + n + 1) === '*') n++
  return n
}

/** 선택 앞뒤에 mark 가 이미 둘러져 있는가? */
export function isWrapped(s: EditorState, r: SelectionRange, mark: string): boolean {
  if (mark === '*') return Math.min(starsBefore(s, r.from), starsAfter(s, r.to)) % 2 === 1
  if (mark === '**') return Math.min(starsBefore(s, r.from), starsAfter(s, r.to)) >= 2
  return s.sliceDoc(r.from - mark.length, r.from) === mark && s.sliceDoc(r.to, r.to + mark.length) === mark
}

export function toggleWrap(view: EditorView, mark: string, close = mark): void {
  const s = view.state
  const tr = s.changeByRange((r) => {
    if (isWrapped(s, r, mark) && close === mark) {
      return {
        changes: [
          { from: r.from - mark.length, to: r.from },
          { from: r.to, to: r.to + mark.length }
        ],
        range: EditorSelection.range(r.anchor - mark.length, r.head - mark.length)
      }
    }
    const text = s.sliceDoc(r.from, r.to)
    // 선택 안에 이미 표시가 들어 있으면 벗긴다
    if (text.length >= mark.length * 2 && text.startsWith(mark) && text.endsWith(close) && close === mark) {
      const inner = text.slice(mark.length, text.length - mark.length)
      return {
        changes: { from: r.from, to: r.to, insert: inner },
        range: EditorSelection.range(r.from, r.from + inner.length)
      }
    }
    return {
      changes: [
        { from: r.from, insert: mark },
        { from: r.to, insert: close }
      ],
      range: r.empty
        ? EditorSelection.cursor(r.from + mark.length)
        : EditorSelection.range(r.from + mark.length, r.to + mark.length)
    }
  })
  run(view, tr)
}

// ───────── 줄 단위: 제목·목록·인용 ─────────

/** 선택이 걸친 줄들(중복 없이). 선택이 다음 줄의 맨 앞에서 끝나면 그 줄은 뺀다. */
export function linesOf(s: EditorState): { from: number; to: number; text: string }[] {
  const seen = new Set<number>()
  const out: { from: number; to: number; text: string }[] = []
  for (const r of s.selection.ranges) {
    const last = r.empty ? r.to : r.to - 1 < r.from ? r.to : r.to - 1
    let pos = s.doc.lineAt(r.from).from
    while (pos <= last) {
      const l = s.doc.lineAt(pos)
      if (!seen.has(l.number)) {
        seen.add(l.number)
        out.push({ from: l.from, to: l.to, text: l.text })
      }
      pos = l.to + 1
      if (l.to >= s.doc.length) break
    }
  }
  return out
}

const HEADING = /^( {0,3})(#{1,6})[ \t]+/

export function headingLevel(s: EditorState): number {
  const l = s.doc.lineAt(s.selection.main.head)
  const m = HEADING.exec(l.text)
  return m ? m[2].length : 0
}

export function setHeading(view: EditorView, level: number): void {
  const s = view.state
  const lines = linesOf(s)
  const changes: ChangeSpec[] = []
  for (const l of lines) {
    const m = HEADING.exec(l.text)
    const cur = m ? m[2].length : 0
    const body = m ? l.text.slice(m[0].length) : l.text
    const want = cur === level ? 0 : level
    const next = (want > 0 ? '#'.repeat(want) + ' ' : '') + body
    if (next !== l.text) changes.push({ from: l.from, to: l.to, insert: next })
  }
  run(view, { changes })
}

const LIST = /^(\s*)(?:[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d+[.)][ \t]+)/
const KIND: Record<string, RegExp> = {
  ul: /^(\s*)[-*+][ \t]+(?!\[[ xX]\])/,
  task: /^(\s*)[-*+][ \t]+\[[ xX]\][ \t]+/,
  ol: /^(\s*)\d+[.)][ \t]+/
}

export interface ListOpt {
  /** 번호 목록 구분 문자: '.' 이면 1.  ')' 이면 1) */
  delim?: '.' | ')'
  /** 체크리스트 상태: false 면 [ ]  true 면 [x] */
  checked?: boolean
}

export function toggleList(view: EditorView, kind: 'ul' | 'ol' | 'task', opt: ListOpt = {}): void {
  const s = view.state
  let lines = linesOf(s)
  const filled = lines.filter((l) => l.text.trim() !== '')
  if (filled.length > 0) lines = filled
  const delim = opt.delim ?? '.'
  let same: RegExp = KIND[kind]
  if (kind === 'ol' && opt.delim) same = new RegExp(`^(\\s*)\\d+\\${delim}[ \\t]+`)
  if (kind === 'task' && opt.checked !== undefined) {
    same = new RegExp(`^(\\s*)[-*+][ \\t]+\\[${opt.checked ? '[xX]' : ' '}\\][ \\t]+`)
  }
  const allHave = lines.every((l) => same.test(l.text))
  const changes: ChangeSpec[] = []
  let n = 1
  for (const l of lines) {
    const m = LIST.exec(l.text)
    const indent = m ? m[1] : (/^\s*/.exec(l.text)?.[0] ?? '')
    const body = m ? l.text.slice(m[0].length) : l.text.slice(indent.length)
    let prefix = ''
    if (!allHave) {
      if (kind === 'ul') prefix = '- '
      else if (kind === 'task') prefix = opt.checked ? '- [x] ' : '- [ ] '
      else prefix = `${n++}${delim} `
    }
    const next = indent + prefix + body
    if (next !== l.text) changes.push({ from: l.from, to: l.to, insert: next })
  }
  run(view, { changes })
}

export function toggleQuote(view: EditorView): void {
  const s = view.state
  let lines = linesOf(s)
  const filled = lines.filter((l) => l.text.trim() !== '')
  if (filled.length > 0) lines = filled
  const allHave = lines.every((l) => /^\s{0,3}>/.test(l.text))
  const changes: ChangeSpec[] = lines.map((l) => ({
    from: l.from,
    to: l.to,
    insert: allHave ? l.text.replace(/^(\s{0,3})>[ ]?/, '$1') : '> ' + l.text
  }))
  run(view, { changes })
}

// ───────── 삽입 ─────────

/** 선택을 앞뒤 글과 함께 text 로 바꾸고, 새 글 안의 [selFrom, selTo) 를 선택한다. */
function replaceSel(view: EditorView, make: (sel: string) => { text: string; from: number; to: number }): void {
  const s = view.state
  const tr = s.changeByRange((r) => {
    const sel = s.sliceDoc(r.from, r.to)
    const o = make(sel)
    return {
      changes: { from: r.from, to: r.to, insert: o.text },
      range: EditorSelection.range(r.from + o.from, r.from + o.to)
    }
  })
  run(view, tr)
}

export function insertLink(view: EditorView): void {
  replaceSel(view, (sel) => {
    if (/^https?:\/\/\S+$/.test(sel)) return { text: `[](${sel})`, from: 1, to: 1 }
    const text = `[${sel}](url)`
    return sel === ''
      ? { text: '[](url)', from: 1, to: 1 }
      : { text, from: sel.length + 3, to: sel.length + 6 }
  })
}

export function insertWikilink(view: EditorView): void {
  replaceSel(view, (sel) => ({ text: `[[${sel}]]`, from: 2 + sel.length, to: 2 + sel.length }))
  startCompletion(view)
}

/** 줄 단위 블록(코드 블록, 수식 블록) 으로 감싼다. */
function fenceLines(view: EditorView, open: string, close: string): void {
  const s = view.state
  const r = s.selection.main
  const a = s.doc.lineAt(r.from)
  const endPos = !r.empty && r.to > a.from && r.to === s.doc.lineAt(r.to).from ? r.to - 1 : r.to
  const b = s.doc.lineAt(endPos)
  if (r.empty && a.text.trim() === '') {
    const text = `${open}\n\n${close}`
    run(view, { changes: { from: a.from, to: a.to, insert: text }, selection: { anchor: a.from + open.length + 1 } })
    return
  }
  const body = s.sliceDoc(a.from, b.to)
  const text = `${open}\n${body}\n${close}`
  run(view, {
    changes: { from: a.from, to: b.to, insert: text },
    selection: { anchor: a.from + open.length + 1, head: a.from + open.length + 1 + body.length }
  })
}

export const insertCodeBlock = (view: EditorView): void => fenceLines(view, '```', '```')
export const insertMathBlock = (view: EditorView): void => fenceLines(view, '$$', '$$')

/** 현재 줄 아래에 빈 줄을 두고 블록을 끼운다. */
function insertBlock(view: EditorView, text: string, selFrom: number, selTo: number): void {
  const s = view.state
  const l = s.doc.lineAt(s.selection.main.head)
  const lead = l.text.trim() === '' ? '' : '\n\n'
  const at = l.text.trim() === '' ? l.from : l.to
  const end = l.to
  const ins = lead + text
  run(view, {
    changes: { from: at, to: end, insert: ins },
    selection: EditorSelection.range(at + lead.length + selFrom, at + lead.length + selTo)
  })
}

export function insertTable(view: EditorView): void {
  const head = '| 제목1 | 제목2 | 제목3 |'
  const text = `${head}\n| --- | --- | --- |\n|  |  |  |\n`
  insertBlock(view, text, 2, 5)
}

export function insertRule(view: EditorView): void {
  const s = view.state
  const l = s.doc.lineAt(s.selection.main.head)
  const lead = l.text.trim() === '' ? '' : '\n\n'
  const at = l.text.trim() === '' ? l.from : l.to
  const end = l.to
  const ins = `${lead}---\n`
  run(view, { changes: { from: at, to: end, insert: ins }, selection: { anchor: at + ins.length } })
}

export function insertFootnote(view: EditorView): void {
  const s = view.state
  const text = s.doc.toString()
  let n = 0
  for (const m of text.matchAll(/\[\^(\d+)\]/g)) n = Math.max(n, Number(m[1]))
  n += 1
  const r = s.selection.main
  const tail = (text.endsWith('\n') ? '' : '\n') + `\n[^${n}]: `
  run(view, {
    changes: [
      { from: r.to, insert: `[^${n}]` },
      { from: s.doc.length, insert: tail }
    ],
    selection: { anchor: r.to + `[^${n}]`.length }
  })
}

// ───────── 수식 ─────────

/** 커서가 $...$ (한 줄) 또는 $$ 블록 안에 있는가? */
export function inMath(s: EditorState): boolean {
  const pos = s.selection.main.head
  const l = s.doc.lineAt(pos)
  const before = l.text.slice(0, pos - l.from).replace(/\\\$/g, '')
  if (before.replace(/\$\$/g, '').split('$').length % 2 === 0) return true
  let fences = 0
  for (let n = 1; n < l.number; n++) if (/^\s*\$\$\s*$/.test(s.doc.line(n).text)) fences++
  return fences % 2 === 1
}

/** 틀 안의 ⟦…⟧ 가 처음 나오는 자리를 선택한다. 수식 밖이면 $ 로 감싼다. */
export function insertMathSnippet(view: EditorView, tpl: string): void {
  const inside = inMath(view.state)
  const m = /⟦([^⟧]*)⟧/.exec(tpl)
  const body = tpl.replace(/⟦([^⟧]*)⟧/g, '$1')
  const selFrom = m ? m.index : body.length
  const selTo = m ? m.index + m[1].length : body.length
  const text = inside ? body : `$${body}$`
  const off = inside ? 0 : 1
  const r = view.state.selection.main
  run(view, {
    changes: { from: r.from, to: r.to, insert: text },
    selection: EditorSelection.range(r.from + off + selFrom, r.from + off + selTo)
  })
}

// ───────── 글자색·배경색 ( {red|글자}  {#ff0000,bg:#ffff00|글자} ) ─────────

const COLOR_TOKEN = /^(bg:)?(red|orange|yellow|green|blue|purple|gray|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})$/

export interface ColorSpan {
  /** 중괄호까지 포함한 전체 범위 */
  from: number
  to: number
  /** 글자 부분(| 다음부터 닫는 } 앞까지) */
  contentFrom: number
  contentTo: number
  fg: string | null
  bg: string | null
}

/** [a, b] 범위를 안에 품은 색 span 을 같은 줄에서 찾는다(머리·글자·꼬리 어디든). */
export function colorSpanAt(s: EditorState, a: number, b: number): ColorSpan | null {
  const line = s.doc.lineAt(a)
  const text = line.text
  const re = /\{([^{}|\n]+)\|/g
  let best: ColorSpan | null = null
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const tokens = m[1].split(',').map((t) => t.trim())
    if (!tokens.every((t) => COLOR_TOKEN.test(t))) continue
    const contentFrom = line.from + m.index + m[0].length
    let depth = 1
    let i = m.index + m[0].length
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
    }
    if (depth !== 0) continue
    const contentTo = line.from + i - 1
    const spanTo = line.from + i
    const spanFrom = line.from + m.index
    // 머리·글자·꼬리 어디에 있든 그 span 안으로 본다 (커서가 중괄호 바로 바깥이면 제외)
    const inside = a === b ? a > spanFrom && a < spanTo : a >= spanFrom && b <= spanTo
    if (!inside) continue
    let fg: string | null = null
    let bg: string | null = null
    for (const t of tokens) {
      if (t.startsWith('bg:')) bg = t.slice(3)
      else fg = t
    }
    const span = { from: line.from + m.index, to: line.from + i, contentFrom, contentTo, fg, bg }
    // 겹쳐 있으면 안쪽(더 짧은 것)을 쓴다
    if (!best || span.to - span.from < best.to - best.from) best = span
  }
  return best
}

const headOf = (fg: string | null, bg: string | null): string =>
  [fg, bg ? `bg:${bg}` : null].filter((x): x is string => !!x).join(',')

/** kind: 글자색(fg) 또는 배경색(bg). color 가 null 이면 그 색을 지운다. */
export function applyColor(view: EditorView, kind: 'fg' | 'bg', color: string | null): void {
  const s = view.state
  const r = s.selection.main
  const span = colorSpanAt(s, r.from, r.to)
  if (span) {
    const fg = kind === 'fg' ? color : span.fg
    const bg = kind === 'bg' ? color : span.bg
    const head = headOf(fg, bg)
    if (head === '') {
      run(view, {
        changes: [
          { from: span.from, to: span.contentFrom },
          { from: span.contentTo, to: span.to }
        ],
        selection: EditorSelection.range(r.anchor - (span.contentFrom - span.from), r.head - (span.contentFrom - span.from))
      })
      return
    }
    const newHead = `{${head}|`
    const delta = newHead.length - (span.contentFrom - span.from)
    run(view, {
      changes: { from: span.from, to: span.contentFrom, insert: newHead },
      selection: EditorSelection.range(r.anchor + delta, r.head + delta)
    })
    return
  }
  if (color === null) return
  const head = kind === 'fg' ? color : `bg:${color}`
  if (r.empty) {
    run(view, {
      changes: { from: r.from, insert: `{${head}|}` },
      selection: { anchor: r.from + head.length + 2 }
    })
    return
  }
  // 여러 줄이면 줄마다 따로 감싼다
  const changes: ChangeSpec[] = []
  let pos = r.from
  let first = -1
  let last = -1
  while (pos <= r.to) {
    const l = s.doc.lineAt(pos)
    const a = Math.max(pos, l.from)
    const b = Math.min(r.to, l.to)
    const seg = s.sliceDoc(a, b)
    if (seg.trim() !== '') {
      const lead = seg.length - seg.trimStart().length
      const trail = seg.length - seg.trimEnd().length
      changes.push({ from: a + lead, insert: `{${head}|` }, { from: b - trail, insert: '}' })
      if (first < 0) first = a + lead
      last = b - trail
    }
    pos = l.to + 1
  }
  if (changes.length === 0) return
  const open = head.length + 2
  const n = changes.length / 2
  run(view, {
    changes,
    selection: EditorSelection.range(first + open, last + open * n)
  })
}