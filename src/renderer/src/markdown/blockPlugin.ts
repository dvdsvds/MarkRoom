import type MarkdownIt from 'markdown-it'
import type { OutputBlock } from '../components/outputBlocks'

type MD = InstanceType<typeof MarkdownIt>
type Align = 'left' | 'center' | 'right'
export type ParsedBlock = { block: OutputBlock } | { error: string }

const OPEN_RE = /^(table|chart)\s*\{\s*$/
const err = (error: string): ParsedBlock => ({ error })
const isAlign = (s: string): s is Align => s === 'left' || s === 'center' || s === 'right'

export function splitCells(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQ = false
        }
      } else {
        cur += c
      }
    } else if (c === '"' && cur.trim() === '') {
      inQ = true
      cur = ''
    } else if (c === ',') {
      cells.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  cells.push(cur.trim())
  return cells
}

function toNumber(s: string): number | null {
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseTable(lines: string[]): ParsedBlock {
  let title = ''
  let alignRaw: string | null = null
  const rows: string[][] = []
  for (const line of lines) {
    if (line === '') continue
    const meta = /^(title|align)\s*:\s*(.*)$/.exec(line)
    if (meta) {
      if (meta[1] === 'title') title = meta[2]
      else alignRaw = meta[2]
      continue
    }
    rows.push(splitCells(line))
  }
  if (rows.length === 0) return err('table: 내용이 없어요. 첫 줄은 머리글이에요.')
  const columns = rows[0]
  if (columns.length > 50) return err('table: 열은 50개까지예요.')
  const data = rows.slice(1)
  if (data.length > 1000) return err('table: 데이터는 1000줄까지예요.')

  const align: Align[] = columns.map(() => 'left')
  if (alignRaw !== null) {
    const parts = splitCells(alignRaw).map((p) => p.toLowerCase())
    for (const p of parts) {
      if (!isAlign(p)) return err(`table: align은 "left", "center", "right" 중 하나예요: ${p}`)
    }
    if (parts.length === 1) {
      align.fill(parts[0] as Align)
    } else {
      parts.forEach((p, i) => {
        if (i < align.length) align[i] = p as Align
      })
    }
  }

  const body = data.map((r) => columns.map((_, c) => r[c] ?? ''))
  return { block: { kind: 'table', title, columns, align, rows: body } }
}

function parseChart(lines: string[]): ParsedBlock {
  let type = ''
  let title = ''
  let labelsRaw: string | null = null
  const entries: { name: string; raw: string }[] = []
  for (const line of lines) {
    if (line === '') continue
    const idx = line.indexOf(':')
    if (idx < 0) return err(`chart: "${line}" 줄에 ':'가 없어요.`)
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    const lower = key.toLowerCase()
    if (lower === 'type') type = value.toLowerCase()
    else if (lower === 'title') title = value
    else if (lower === 'labels') labelsRaw = value
    else entries.push({ name: key, raw: value })
  }
  if (type !== 'bar' && type !== 'line' && type !== 'pie') {
    return err(`chart: type은 "bar", "line", "pie" 중 하나예요: ${type || '(없음)'}`)
  }
  if (entries.length === 0) return err('chart: 데이터가 없어요.')

  let labels: string[]
  let series: { name: string; values: number[] }[]
  if (labelsRaw !== null) {
    labels = splitCells(labelsRaw)
    series = []
    for (const e of entries) {
      const cells = splitCells(e.raw)
      if (cells.length !== labels.length) {
        return err(`chart: labels는 ${labels.length}개인데 ${e.name} 값은 ${cells.length}개예요.`)
      }
      const values: number[] = []
      for (const c of cells) {
        const n = toNumber(c)
        if (n === null) return err(`chart: ${e.name}의 값이 숫자가 아니에요: ${c}`)
        values.push(n)
      }
      series.push({ name: e.name, values })
    }
  } else {
    labels = []
    const values: number[] = []
    for (const e of entries) {
      const n = toNumber(e.raw)
      if (n === null) return err(`chart: ${e.name}의 값이 숫자가 아니에요: ${e.raw}`)
      labels.push(e.name)
      values.push(n)
    }
    series = [{ name: '', values }]
  }

  if (labels.length > 200) return err('chart: 항목은 200개까지예요.')
  if (series.length > 8) return err('chart: 계열은 8개까지예요.')
  if (type === 'pie') {
    if (series.length !== 1) return err('chart: pie는 값 하나만 받아요.')
    if (labels.length > 12) return err('chart: pie는 항목 12개까지예요.')
    let sum = 0
    for (const v of series[0].values) {
      if (v < 0) return err('chart: pie에는 음수를 쓸 수 없어요.')
      sum += v
    }
    if (sum <= 0) return err('chart: pie 값의 합이 0이에요.')
  }
  return { block: { kind: 'chart', type, title, labels, series } }
}

export function parseBlock(kind: string, lines: string[]): ParsedBlock {
  return kind === 'table' ? parseTable(lines) : parseChart(lines)
}

export function blockPlugin(md: MD): void {
  md.block.ruler.before(
    'fence',
    'snote_block',
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false
      const lineText = (n: number): string =>
        state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n])
      const open = OPEN_RE.exec(lineText(startLine))
      if (!open) return false

      const lines: string[] = []
      let next = startLine + 1
      let closed = false
      for (; next < endLine; next++) {
        const text = lineText(next).trim()
        if (text === '}') {
          closed = true
          break
        }
        lines.push(text)
      }
      if (!closed) return false
      if (silent) return true

      const token = state.push('snote_block', 'div', 0)
      token.block = true
      token.map = [startLine, next + 1]
      token.meta = { kind: open[1], lines }
      state.line = next + 1
      return true
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] }
  )

  md.renderer.rules.snote_block = (tokens, idx) => {
    const { kind, lines } = tokens[idx].meta as { kind: string; lines: string[] }
    const spec = md.utils.escapeHtml(JSON.stringify(parseBlock(kind, lines)))
    return `<div class="snote-block" data-spec="${spec}"></div>\n`
  }
}