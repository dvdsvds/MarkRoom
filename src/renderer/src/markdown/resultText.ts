import type { OutputBlock } from '../utils/outputBlocks'

type TableBlock = Extract<OutputBlock, { kind: 'table' }>
type ChartBlock = Extract<OutputBlock, { kind: 'chart' }>

const RESERVED = /^(type|title|labels)$/i
const OUT_OPEN = /^(`{3,})output\s*$/
const BLOCK_OPEN = /^(table|chart)\s*\{\s*$/
const STOP_LINE = /^\s*(`{3,}|~{3,})|^#{1,6}\s/
const MAX_BLOCK_LINES = 2000

const oneLine = (s: string): string => s.replace(/\s*\r?\n\s*/g, ' ').trim()

function quote(s: string, force: boolean): string {
  const need = force || /[,"]/.test(s) || s === '}' || /^(title|align)\s*:/.test(s)
  return need ? `"${s.replace(/"/g, '""')}"` : s
}

function tableToText(b: TableBlock): string[] {
  const out = ['table {']
  const title = oneLine(b.title)
  if (title) out.push(`  title: ${title}`)
  const align = b.align ?? []
  if (align.some((a) => a !== 'left')) out.push(`  align: ${align.join(', ')}`)
  const single = b.columns.length === 1
  const row = (cells: (string | number)[]): string =>
    '  ' +
    cells
      .map((c) => {
        const s = oneLine(String(c))
        return quote(s, single && s === '')
      })
      .join(', ')
  out.push(row(b.columns))
  for (const r of b.rows) out.push(row(r))
  out.push('}')
  return out
}

function safeKey(s: string): boolean {
  return s !== '' && !s.includes(':') && !RESERVED.test(s)
}

function chartToText(b: ChartBlock): string[] {
  const out = ['chart {', `  type: ${b.type}`]
  const title = oneLine(b.title)
  if (title) out.push(`  title: ${title}`)
  const labels = b.labels.map(oneLine)
  const simple = b.series.length === 1 && b.series[0].name === '' && labels.every(safeKey)
  if (simple) {
    labels.forEach((l, i) => out.push(`  ${l}: ${b.series[0].values[i]}`))
  } else {
    out.push(`  labels: ${labels.map((l) => quote(l, l === '')).join(', ')}`)
    for (const s of b.series) {
      let name = oneLine(s.name).replace(/:/g, '-')
      if (name === '') name = 'values'
      else if (RESERVED.test(name)) name = `${name}_`
      out.push(`  ${name}: ${s.values.join(', ')}`)
    }
  }
  out.push('}')
  return out
}

export function blockToText(b: OutputBlock): string[] {
  return b.kind === 'table' ? tableToText(b) : chartToText(b)
}

export function outputToText(text: string): string[] {
  let longest = 2
  for (const m of text.matchAll(/`+/g)) longest = Math.max(longest, m[0].length)
  const fence = '`'.repeat(longest + 1)
  return [`${fence}output`, ...text.replace(/\r\n?/g, '\n').split('\n'), fence]
}

function findFenceClose(lines: string[], open: number, n: number): number {
  const re = new RegExp('^`{' + n + ',}\\s*$')
  for (let k = open + 1; k < lines.length; k++) if (re.test(lines[k])) return k
  return -1
}

function findBlockClose(lines: string[], open: number): number {
  for (let k = open + 1; k < lines.length && k - open <= MAX_BLOCK_LINES; k++) {
    if (lines[k].trim() === '}') return k
    if (STOP_LINE.test(lines[k])) return -1
  }
  return -1
}

/** 코드 블록 바로 아래에 이어진 output / table / chart 블록의 끝(제외) 줄 번호. 없으면 start. */
function resultEnd(lines: string[], start: number): number {
  let end = start
  let i = start
  for (;;) {
    while (i < lines.length && lines[i].trim() === '') i++
    if (i >= lines.length) break
    const out = OUT_OPEN.exec(lines[i])
    if (out) {
      const k = findFenceClose(lines, i, out[1].length)
      if (k < 0) break
      end = k + 1
      i = end
      continue
    }
    if (BLOCK_OPEN.test(lines[i])) {
      const k = findBlockClose(lines, i)
      if (k < 0) break
      end = k + 1
      i = end
      continue
    }
    break
  }
  return end
}

/** fenceEnd는 닫는 코드 펜스 다음 줄(0부터). 못 찾으면 null. */
export function applyResult(
  source: string,
  fenceStart: number,
  fenceEnd: number,
  parts: string[][]
): string | null {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  if (!/^ {0,3}(`{3,}|~{3,})/.test(lines[fenceStart] ?? '')) return null
  if (fenceEnd <= fenceStart || fenceEnd > lines.length) return null
  const end = resultEnd(lines, fenceEnd)
  const added: string[] = []
  for (const p of parts) added.push('', ...p)
  const rest = lines.slice(end)
  if (rest.length > 0 && rest[0].trim() !== '') added.push('')
  return [...lines.slice(0, fenceEnd), ...added, ...rest].join('\n')
}
