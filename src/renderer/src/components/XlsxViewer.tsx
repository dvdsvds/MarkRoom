import { useEffect, useMemo, useState } from 'react'
import type { Cell, CellValue, Worksheet } from 'exceljs'
import { OfficeViewerFrame } from './OfficeViewerFrame'
import { loadFileBytes } from '../utils/loadFileBytes'

const MAX_ROWS = 5000
const MAX_COLS = 200
const DEFAULT_COL_PX = 80

interface CellView {
  text: string
  style: React.CSSProperties
  rowSpan?: number
  colSpan?: number
}

interface SheetView {
  name: string
  rowCount: number
  colCount: number
  truncated: boolean
  cells: Map<string, CellView>
  covered: Set<string>
  colWidths: number[]
}

const key = (r: number, c: number): string => `${r}:${c}`

function colLetter(n: number): string {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function argbToCss(argb: string | undefined): string | undefined {
  if (!argb || argb.length < 6) return undefined
  return `#${argb.slice(-6)}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatDate(d: Date, numFmt: string | undefined): string {
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  const hasTime = numFmt ? /h|ss/i.test(numFmt) : d.getUTCHours() + d.getUTCMinutes() > 0
  return hasTime ? `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : date
}

function formatNumber(v: number, numFmt: string | undefined): string {
  const fmt = numFmt ?? ''
  const decimals = /\.(0+)/.exec(fmt)?.[1].length
  if (fmt.includes('%')) return `${(v * 100).toFixed(decimals ?? 0)}%`
  if (fmt.includes(',')) {
    return v.toLocaleString('ko-KR', {
      minimumFractionDigits: decimals ?? 0,
      maximumFractionDigits: decimals ?? 0
    })
  }
  if (decimals !== undefined) return v.toFixed(decimals)
  return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(12)))
}

function valueText(v: CellValue, numFmt: string | undefined): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return formatDate(v, numFmt)
  if (typeof v === 'number') return formatNumber(v, numFmt)
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'string') return v
  if ('richText' in v) return v.richText.map((t) => t.text).join('')
  if ('error' in v) return String(v.error)
  if ('formula' in v || 'sharedFormula' in v) {
    return valueText((v as { result?: CellValue }).result ?? null, numFmt)
  }
  if ('hyperlink' in v) return String(v.text ?? v.hyperlink)
  return ''
}

/** 수식 칸이면 계산 결과를, 아니면 값 그대로를 돌려준다. */
function shownValue(v: CellValue): CellValue {
  if (
    v &&
    typeof v === 'object' &&
    !(v instanceof Date) &&
    ('formula' in v || 'sharedFormula' in v)
  ) {
    return (v as { result?: CellValue }).result ?? null
  }
  return v
}

function cellStyle(cell: Cell): React.CSSProperties {
  const style: React.CSSProperties = {}
  const font = cell.font
  if (font?.bold) style.fontWeight = 600
  if (font?.italic) style.fontStyle = 'italic'
  if (font?.underline) style.textDecoration = 'underline'
  const color = argbToCss(font?.color?.argb)
  if (color) style.color = color
  const fill = cell.fill
  if (fill?.type === 'pattern' && fill.pattern === 'solid') {
    const bg = argbToCss(fill.fgColor?.argb)
    if (bg) style.background = bg
  }
  const align = cell.alignment
  if (align?.horizontal && ['left', 'center', 'right'].includes(align.horizontal)) {
    style.textAlign = align.horizontal as 'left' | 'center' | 'right'
  } else if (typeof shownValue(cell.value) === 'number' || shownValue(cell.value) instanceof Date) {
    style.textAlign = 'right'
  }
  if (align?.vertical === 'top') style.verticalAlign = 'top'
  else if (align?.vertical === 'bottom') style.verticalAlign = 'bottom'
  if (align?.wrapText) style.whiteSpace = 'pre-wrap'
  return style
}

function parseRange(ref: string): [number, number, number, number] | null {
  const m = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(ref)
  if (!m) return null
  const col = (s: string): number => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
  return [Number(m[2]), col(m[1]), Number(m[4]), col(m[3])]
}

function buildSheet(ws: Worksheet): SheetView {
  const rowCount = Math.min(ws.rowCount, MAX_ROWS)
  const colCount = Math.min(ws.columnCount, MAX_COLS)
  const cells = new Map<string, CellView>()
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    if (r > rowCount) return
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      if (c > colCount) return
      cells.set(key(r, c), { text: valueText(cell.value, cell.numFmt), style: cellStyle(cell) })
    })
  })
  const covered = new Set<string>()
  for (const ref of ws.model.merges ?? []) {
    const range = parseRange(ref)
    if (!range) continue
    const [r1, c1, r2, c2] = range
    if (r1 > rowCount || c1 > colCount) continue
    const master = cells.get(key(r1, c1)) ?? { text: '', style: {} }
    master.rowSpan = Math.min(r2, rowCount) - r1 + 1
    master.colSpan = Math.min(c2, colCount) - c1 + 1
    cells.set(key(r1, c1), master)
    for (let r = r1; r <= Math.min(r2, rowCount); r++) {
      for (let c = c1; c <= Math.min(c2, colCount); c++) {
        if (r !== r1 || c !== c1) covered.add(key(r, c))
      }
    }
  }
  const colWidths = Array.from({ length: colCount }, (_, i) => {
    const w = ws.getColumn(i + 1).width
    return w ? Math.round(w * 7 + 5) : DEFAULT_COL_PX
  })
  return {
    name: ws.name,
    rowCount,
    colCount,
    truncated: ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS,
    cells,
    covered,
    colWidths
  }
}

function SheetTable({ sheet }: { sheet: SheetView }): React.JSX.Element {
  const rows = useMemo(
    () => Array.from({ length: sheet.rowCount }, (_, i) => i + 1),
    [sheet.rowCount]
  )
  const cols = useMemo(
    () => Array.from({ length: sheet.colCount }, (_, i) => i + 1),
    [sheet.colCount]
  )
  if (sheet.rowCount === 0 || sheet.colCount === 0) {
    return <p className="p-6 text-[13px] text-text-tertiary">빈 시트예요.</p>
  }
  return (
    <table className="xlsx-table border-separate border-spacing-0 text-[12.5px] text-text">
      <colgroup>
        <col style={{ width: 44 }} />
        {sheet.colWidths.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          <th className="xlsx-corner" />
          {cols.map((c) => (
            <th key={c} className="xlsx-colhead">
              {colLetter(c)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r}>
            <th className="xlsx-rowhead">{r}</th>
            {cols.map((c) => {
              const k = key(r, c)
              if (sheet.covered.has(k)) return null
              const cell = sheet.cells.get(k)
              return (
                <td
                  key={c}
                  rowSpan={cell?.rowSpan}
                  colSpan={cell?.colSpan}
                  style={cell?.style}
                  className="xlsx-cell"
                >
                  {cell?.text}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function XlsxViewer({ filePath }: { filePath: string }): React.JSX.Element {
  const [sheets, setSheets] = useState<SheetView[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [mod, data] = await Promise.all([import('exceljs'), loadFileBytes(filePath)])
        const Excel = ('default' in mod ? mod.default : mod) as typeof import('exceljs')
        const workbook = new Excel.Workbook()
        await workbook.xlsx.load(data)
        if (cancelled) return
        const visible = workbook.worksheets.filter((ws) => ws.state === 'visible')
        setSheets(visible.map(buildSheet))
        setActive(0)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filePath])

  const sheet = sheets[active]

  const footer =
    sheets.length > 0 ? (
      <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-t border-border px-2">
        {sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setActive(i)}
            className={`shrink-0 rounded px-2.5 py-1 text-[12px] transition-colors ${
              i === active ? 'bg-bg-mute text-text' : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {s.name}
          </button>
        ))}
        {sheet?.truncated && (
          <span className="ml-auto shrink-0 px-2 text-[11px] text-text-tertiary">
            {MAX_ROWS.toLocaleString()}행·{MAX_COLS}열까지만 보여요
          </span>
        )}
      </div>
    ) : null

  return (
    <OfficeViewerFrame filePath={filePath} error={error} loading={loading} footer={footer}>
      <div className="h-full overflow-auto">{sheet && <SheetTable sheet={sheet} />}</div>
    </OfficeViewerFrame>
  )
}
