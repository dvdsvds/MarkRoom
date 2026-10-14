import { getCurrentView } from '../../../editor/currentView'

const cellIndent = (def: string): string => (/^\s*/.exec(def)?.[0] ?? '') + '  '
const cellBody = (def: string, text: string): string[] =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => cellIndent(def) + l)

export function replaceCellText(defLine: number, endLine: number, text: string): void {
  const view = getCurrentView()
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
  const view = getCurrentView()
  if (!view) return null
  const doc = view.state.doc
  return compute((n) => doc.line(n).text)
}

export function docLineReader(): ((n: number) => string) | null {
  const view = getCurrentView()
  if (!view) return null
  const doc = view.state.doc
  return (n) => (n >= 1 && n <= doc.lines ? doc.line(n).text : '')
}

export function applyGridEdit(
  compute: (
    getLine: (n: number) => string
  ) => { ok: true; from: number; to: number; lines: string[] } | { ok: false; error: string }
): string | null {
  const view = getCurrentView()
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

export function replaceTextLine(line: number, text: string): void {
  const view = getCurrentView()
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

export function splitTextLine(line: number, before: string, after: string): void {
  const view = getCurrentView()
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

export function deleteEmptyTextLine(line: number): boolean {
  const view = getCurrentView()
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

export function addTextLine(close: number): boolean {
  const view = getCurrentView()
  if (!view) return false
  const doc = view.state.doc
  if (close < 1 || close > doc.lines) return false
  const l = doc.line(close)
  if (l.text.trim() !== ']') return false
  const indent = /^\s*/.exec(l.text)?.[0] ?? ''
  view.dispatch({ changes: { from: l.from, insert: `${indent}  text :\n` }, userEvent: 'input.cell' })
  return true
}

export function addCellText(
  afterLine: number,
  r: number,
  c: number,
  rs: number,
  cs: number,
  text: string
): void {
  const view = getCurrentView()
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