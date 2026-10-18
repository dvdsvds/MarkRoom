import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { create } from 'zustand'
import { fileNameOf, splitName } from '../utils/path'

export const COLUMN_COLORS = 8

// 두 글자 후보가 한 글자 후보보다 앞에 있어야 한 줄을 나눌 때 먼저 잡힌다
export const DELIMITER_CANDIDATES = [', ', '||', ',', ';', '\t', '|', '^', '~', ':']

const EXT_HINT: Record<string, string> = {
  csv: ',',
  tsv: '\t',
  tab: '\t',
  psv: '|',
  dsv: ','
}

const SNIFF_LINES = 20

export function delimitedHint(filePath: string): string | null {
  return EXT_HINT[splitName(fileNameOf(filePath)).ext.slice(1).toLowerCase()] ?? null
}

export function delimiterLabel(delimiter: string | null): string {
  switch (delimiter) {
    case null:
      return '끔'
    case '\t':
      return '탭'
    case ', ':
      return '쉼표+공백'
    case ' ':
      return '공백'
    default:
      return delimiter
  }
}

export interface FieldRange {
  from: number
  to: number
}

/** 한 줄을 칸과 구분자 위치로 나눈다. 따옴표로 감싼 칸 안의 구분자는 무시한다. */
export function splitLine(
  text: string,
  delimiter: string
): { cells: FieldRange[]; delimiters: FieldRange[] } {
  const cells: FieldRange[] = []
  const delimiters: FieldRange[] = []
  let start = 0
  let i = 0
  let inQuote = false
  let cellStart = true
  while (i < text.length) {
    const ch = text[i]
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') i += 2
        else {
          inQuote = false
          i += 1
        }
      } else i += 1
      continue
    }
    if (cellStart && ch === '"') {
      inQuote = true
      cellStart = false
      i += 1
      continue
    }
    if (text.startsWith(delimiter, i)) {
      cells.push({ from: start, to: i })
      delimiters.push({ from: i, to: i + delimiter.length })
      i += delimiter.length
      start = i
      cellStart = true
      continue
    }
    cellStart = false
    i += 1
  }
  cells.push({ from: start, to: text.length })
  return { cells, delimiters }
}

function sampleLines(text: string): string[] {
  const out: string[] = []
  let pos = 0
  while (out.length < SNIFF_LINES && pos < text.length) {
    let end = text.indexOf('\n', pos)
    if (end === -1) end = text.length
    const line = text.slice(pos, end).replace(/\r$/, '')
    if (line.trim()) out.push(line)
    pos = end + 1
  }
  return out
}

/** 앞쪽 줄들을 보고 모든 줄에서 같은 횟수로 나오는 구분자를 고른다. 없으면 null. */
export function detectDelimiter(text: string, hint: string | null): string | null {
  const lines = sampleLines(text)
  if (lines.length === 0) return hint
  const counts = new Map<string, number[]>()
  for (const d of DELIMITER_CANDIDATES) {
    counts.set(
      d,
      lines.map((l) => splitLine(l, d).delimiters.length)
    )
  }
  const consistent = DELIMITER_CANDIDATES.filter((d) => {
    const c = counts.get(d) as number[]
    return c[0] > 0 && c.every((n) => n === c[0])
  })
  // 두 글자 구분자가 한 글자 구분자를 전부 품고 있으면(예: 모든 쉼표 뒤에 공백) 두 글자 쪽만 남긴다
  const dominated = new Set<string>()
  for (const long of consistent.filter((d) => d.length > 1)) {
    for (const short of consistent.filter((d) => d.length === 1 && long.includes(d))) {
      const allInside = lines.every((l) => {
        const { cells } = splitLine(l, long)
        return cells.every((c) => splitLine(l.slice(c.from, c.to), short).delimiters.length === 0)
      })
      if (allInside) dominated.add(short)
    }
  }
  const pool = consistent.filter((d) => !dominated.has(d))
  if (pool.length > 0) {
    const score = (d: string): number => (counts.get(d) as number[])[0]
    return [...pool].sort((a, b) => {
      if (score(b) !== score(a)) return score(b) - score(a)
      if (a === hint) return -1
      if (b === hint) return 1
      return 0
    })[0]
  }
  // 줄마다 조금씩 다르면 횟수가 가장 고른 후보
  let best: string | null = null
  let bestSpread = Infinity
  for (const d of DELIMITER_CANDIDATES) {
    const c = counts.get(d) as number[]
    if (Math.min(...c) === 0) continue
    const spread = Math.max(...c) - Math.min(...c)
    if (spread < bestSpread) {
      best = d
      bestSpread = spread
    }
  }
  return best
}

export interface CsvConfig {
  delimiter: string | null
  header: boolean
}

export const setCsvConfig = StateEffect.define<Partial<CsvConfig>>()

const csvConfigField = StateField.define<CsvConfig>({
  create: () => ({ delimiter: null, header: true }),
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setCsvConfig)) value = { ...value, ...e.value }
    return value
  }
})

interface CsvStatus {
  active: boolean
  delimiter: string | null
  header: boolean
  column: number | null
  columnName: string | null
}

const EMPTY_STATUS: CsvStatus = {
  active: false,
  delimiter: null,
  header: true,
  column: null,
  columnName: null
}

export const useCsvStatus = create<CsvStatus>(() => EMPTY_STATUS)

const cellMarks = Array.from({ length: COLUMN_COLORS }, (_, i) =>
  Decoration.mark({ class: `cm-csv-c${i}` })
)
const headMarks = Array.from({ length: COLUMN_COLORS }, (_, i) =>
  Decoration.mark({ class: `cm-csv-c${i} cm-csv-head` })
)
const delimiterMark = Decoration.mark({ class: 'cm-csv-delim' })

function buildDecorations(view: EditorView): DecorationSet {
  const { delimiter, header } = view.state.field(csvConfigField)
  const builder = new RangeSetBuilder<Decoration>()
  if (!delimiter) return builder.finish()
  const doc = view.state.doc
  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.length > 0) {
        const marks = header && line.number === 1 ? headMarks : cellMarks
        const { cells, delimiters } = splitLine(line.text, delimiter)
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i]
          if (cell.to > cell.from) {
            builder.add(line.from + cell.from, line.from + cell.to, marks[i % COLUMN_COLORS])
          }
          const d = delimiters[i]
          if (d) builder.add(line.from + d.from, line.from + d.to, delimiterMark)
        }
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

function cellText(text: string, range: FieldRange): string {
  const raw = text.slice(range.from, range.to).trim()
  return raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')
    ? raw.slice(1, -1).replace(/""/g, '"')
    : raw
}

function statusOf(state: EditorState): CsvStatus {
  const { delimiter, header } = state.field(csvConfigField)
  if (!delimiter) return { ...EMPTY_STATUS, active: true, delimiter, header }
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  const { cells } = splitLine(line.text, delimiter)
  const offset = head - line.from
  let index = cells.findIndex((c) => offset <= c.to)
  if (index === -1) index = cells.length - 1
  let columnName: string | null = null
  if (header) {
    const first = state.doc.line(1).text
    const headCell = splitLine(first, delimiter).cells[index]
    columnName = headCell ? cellText(first, headCell) || null : null
  }
  return { active: true, delimiter, header, column: index + 1, columnName }
}

let statusOwner: object | null = null

const csvPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    // 탭을 바꿀 때 새 플러그인이 먼저 생겨도 이전 플러그인의 destroy가 상태를 지우지 않게 하는 표시
    private readonly owner = {}
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
      statusOwner = this.owner
      useCsvStatus.setState(statusOf(view.state))
    }
    update(update: ViewUpdate): void {
      const configChanged =
        update.startState.field(csvConfigField) !== update.state.field(csvConfigField)
      if (update.docChanged || update.viewportChanged || configChanged) {
        this.decorations = buildDecorations(update.view)
      }
      if (update.docChanged || update.selectionSet || configChanged) {
        statusOwner = this.owner
        useCsvStatus.setState(statusOf(update.state))
      }
    }
    destroy(): void {
      if (statusOwner !== this.owner) return
      statusOwner = null
      useCsvStatus.setState(EMPTY_STATUS)
    }
  },
  { decorations: (v) => v.decorations }
)

/** 구분자로 나뉜 파일의 열마다 색을 입힌다. delimiter가 null이면 꺼진 상태로 시작한다. */
export function csvColumns(initial: CsvConfig): Extension {
  return [csvConfigField.init(() => initial), csvPlugin]
}
