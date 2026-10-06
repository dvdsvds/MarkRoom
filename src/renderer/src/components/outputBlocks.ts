type RunResult = Awaited<ReturnType<typeof window.api.code.run>>
export type OutputBlock = RunResult['blocks'][number]
type TableBlock = Extract<OutputBlock, { kind: 'table' }>
type ChartBlock = Extract<OutputBlock, { kind: 'chart' }>

const SVG_NS = 'http://www.w3.org/2000/svg'
const W = 640
const H = 320
const PAD_T = 16
const PAD_R = 16
const PAD_B = 44

function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  text?: string
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const key of Object.keys(attrs)) el.setAttribute(key, String(attrs[key]))
  if (text !== undefined) el.textContent = text
  return el
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text !== undefined) el.textContent = text
  return el
}

const color = (i: number): string => `var(--chart-${(i % 8) + 1})`
const fmt = (n: number): string => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 })

function niceTicks(min: number, max: number): number[] {
  if (min === max) {
    const pad = Math.abs(min) || 1
    min -= pad
    max += pad
  }
  const raw = (max - min) / 5
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  const first = Math.floor(min / step)
  const last = Math.ceil(max / step)
  const ticks: number[] = []
  for (let k = first; k <= last; k++) ticks.push(Number((k * step).toPrecision(12)))
  return ticks
}

function buildLegend(block: ChartBlock): HTMLElement {
  const legend = h('div', 'code-chart-legend')
  block.series.forEach((ser, i) => {
    const item = h('span', 'code-chart-legend-item')
    const sw = h('span', 'code-chart-swatch')
    sw.style.background = color(i)
    item.appendChild(sw)
    item.appendChild(document.createTextNode(ser.name))
    legend.appendChild(item)
  })
  return legend
}

function buildCartesian(block: ChartBlock): SVGSVGElement {
  const isBar = block.type === 'bar'
  const all = block.series.flatMap((x) => x.values)
  let lo = Math.min(...all)
  let hi = Math.max(...all)
  if (isBar) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  const ticks = niceTicks(lo, hi)
  if (isBar && lo < 0 && ticks.length > 1) {
    const step = ticks[1] - ticks[0]
    if (lo - ticks[0] < step * 0.3) {
      ticks.unshift(Number((ticks[0] - step).toPrecision(12)))
    }
  }
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const tickText = ticks.map(fmt)
  const padL = Math.max(40, Math.max(...tickText.map((t) => t.length)) * 7 + 16)
  const plotW = W - padL - PAD_R
  const plotH = H - PAD_T - PAD_B
  const y = (v: number): number => PAD_T + plotH - ((v - yMin) / (yMax - yMin)) * plotH
  const n = block.labels.length
  const band = plotW / n
  const xc = (i: number): number => padL + band * (i + 0.5)

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' })

  ticks.forEach((t, i) => {
    svg.appendChild(
      s('line', {
        x1: padL,
        x2: W - PAD_R,
        y1: y(t),
        y2: y(t),
        class: t === 0 ? 'code-chart-axis' : 'code-chart-grid'
      })
    )
    svg.appendChild(
      s('text', { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'code-chart-tick' }, tickText[i])
    )
  })

  const maxLabels = Math.max(1, Math.floor(plotW / 56))
  const every = Math.ceil(n / maxLabels)
  const maxChars = Math.max(3, Math.floor((band * every) / 7))
  block.labels.forEach((label, i) => {
    if (i % every !== 0) return
    const shown = label.length > maxChars ? label.slice(0, maxChars - 1) + '…' : label
    const t = s(
      'text',
      { x: xc(i), y: H - PAD_B + 18, 'text-anchor': 'middle', class: 'code-chart-tick' },
      shown
    )
    t.appendChild(s('title', {}, label))
    svg.appendChild(t)
  })

  const m = block.series.length
  if (isBar) {
    const inner = band * 0.7
    const barW = inner / m
    const y0 = y(0)
    block.series.forEach((ser, si) => {
      ser.values.forEach((v, i) => {
        const top = Math.min(y(v), y0)
        const height = v === 0 ? 0 : Math.max(Math.abs(y(v) - y0), 1)
        const rect = s('rect', {
          x: xc(i) - inner / 2 + si * barW,
          y: top,
          width: Math.max(barW - (m > 1 ? 1 : 0), 1),
          height,
          rx: 2,
          style: `fill:${color(si)}`
        })
        rect.appendChild(
          s('title', {}, `${block.labels[i]}${ser.name ? ' · ' + ser.name : ''}: ${fmt(v)}`)
        )
        svg.appendChild(rect)
        if (m === 1 && n <= 12) {
          svg.appendChild(
            s(
              'text',
              {
                x: xc(i),
                y: v >= 0 ? y(v) - 4 : y(v) + 12,
                'text-anchor': 'middle',
                class: 'code-chart-value'
              },
              fmt(v)
            )
          )
        }
      })
    })
  } else {
    block.series.forEach((ser, si) => {
      const pts = ser.values.map((v, i) => `${xc(i).toFixed(1)} ${y(v).toFixed(1)}`)
      svg.appendChild(
        s('path', {
          d: 'M' + pts.join(' L'),
          fill: 'none',
          style: `stroke:${color(si)};stroke-width:2;stroke-linejoin:round;stroke-linecap:round`
        })
      )
      if (n <= 60) {
        ser.values.forEach((v, i) => {
          const dot = s('circle', { cx: xc(i), cy: y(v), r: 3, style: `fill:${color(si)}` })
          dot.appendChild(
            s('title', {}, `${block.labels[i]}${ser.name ? ' · ' + ser.name : ''}: ${fmt(v)}`)
          )
          svg.appendChild(dot)
        })
      }
    })
  }
  return svg
}

function buildPie(block: ChartBlock): HTMLElement {
  const values = block.series[0].values
  const sum = values.reduce((a, b) => a + b, 0)
  const size = 240
  const c = size / 2
  const r = c - 8
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, role: 'img' })
  let angle = -Math.PI / 2
  values.forEach((v, i) => {
    if (v <= 0) return
    const frac = v / sum
    const tip = `${block.labels[i]}: ${fmt(v)} (${(frac * 100).toFixed(1)}%)`
    let shape: SVGElement
    if (frac >= 0.9999) {
      shape = s('circle', { cx: c, cy: c, r })
    } else {
      const next = angle + frac * Math.PI * 2
      const x1 = c + r * Math.cos(angle)
      const y1 = c + r * Math.sin(angle)
      const x2 = c + r * Math.cos(next)
      const y2 = c + r * Math.sin(next)
      shape = s('path', {
        d: `M ${c} ${c} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
      })
      angle = next
    }
    shape.setAttribute('style', `fill:${color(i)};stroke:var(--color-bg);stroke-width:1.5`)
    shape.appendChild(s('title', {}, tip))
    svg.appendChild(shape)
  })

  const legend = h('div', 'code-chart-legend code-chart-legend-col')
  values.forEach((v, i) => {
    const item = h('span', 'code-chart-legend-item')
    const sw = h('span', 'code-chart-swatch')
    sw.style.background = color(i)
    item.appendChild(sw)
    item.appendChild(document.createTextNode(`${block.labels[i]}  `))
    item.appendChild(h('span', 'code-chart-pct', `${((v / sum) * 100).toFixed(1)}%`))
    legend.appendChild(item)
  })
  const wrap = h('div', 'code-chart-pie')
  wrap.appendChild(svg)
  wrap.appendChild(legend)
  return wrap
}

function buildChart(block: ChartBlock): HTMLElement {
  const box = h('div', 'code-chart')
  if (block.title) box.appendChild(h('div', 'code-block-title', block.title))
  if (block.type === 'pie') {
    box.appendChild(buildPie(block))
  } else {
    box.appendChild(buildCartesian(block))
    if (block.series.length > 1) box.appendChild(buildLegend(block))
  }
  return box
}

function buildTable(block: TableBlock): HTMLElement {
  const box = h('div', 'code-table')
  if (block.title) box.appendChild(h('div', 'code-block-title', block.title))
  const scroll = h('div', 'code-table-scroll')
  const table = h('table')
  const cls = (c: number): string => `a-${block.align[c] ?? 'left'}`
  const headRow = h('tr')
  block.columns.forEach((col, c) => headRow.appendChild(h('th', cls(c), col)))
  table.appendChild(h('thead')).appendChild(headRow)
  const tbody = h('tbody')
  for (const row of block.rows) {
    const tr = h('tr')
    row.forEach((cell, c) => tr.appendChild(h('td', cls(c), String(cell))))
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  scroll.appendChild(table)
  box.appendChild(scroll)
  return box
}

export function renderBlocks(blocks: OutputBlock[]): HTMLElement[] {
  return blocks.map((b) => {
    try {
      return b.kind === 'table' ? buildTable(b) : buildChart(b)
    } catch {
      return h('div', 'code-run-out error', '표/차트를 그릴 수 없어요. 데이터 모양을 확인해 주세요.')
    }
  })
}