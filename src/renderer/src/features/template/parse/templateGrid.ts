import type { FrameKind, GridCell, Opt, Style, TNode } from './templateTypes'
import { Ctx, merge, parseOpts } from './templateOpts'
import {
  DEFAULT_ROW_MM,
  DEF_RE,
  MAX_ROWS,
  OPENER_RE,
  PAPER_MM,
  clamp,
  fill,
  indentOf,
  nextRaw,
  num,
  skipBlock,
  splitColon,
  tokenize,
  unesc
} from './templateUtil'

export function parseWidths(val: string, ctx: Ctx): (number | null)[] | null {
  const out: (number | null)[] = []
  for (const part of val.split(',')) {
    const p = part.trim()
    if (p === '-') {
      out.push(null)
      continue
    }
    const n = num(p, 1, PAPER_MM)
    if (n === null) {
      ctx.warn(`grid: widths= 값은 1~${PAPER_MM} 숫자나 - 예요: ${p}`)
      return null
    }
    out.push(n)
  }
  return out
}

type Def = {
  c1: number
  c2: number
  r1: number | null
  r2: number | null
  opt: Opt
  lines: string[]
  indent: number
  label: string
  d1: number
  d2: number
  paras: { text: string; head: string; opt: Opt }[] | null
}

export function parseGrid(
  lines: string[],
  pos: { i: number },
  vars: Map<string, string>,
  ctx: Ctx,
  colsIn: number,
  frame: FrameKind,
  frameW: number | null,
  frameC: string | null,
  widthsIn: (number | null)[] | null,
  pageStyle: Style,
  headLine: number,
  rowsIn: number
): TNode {
  let cols = colsIn
  if (cols < 1 || cols > 100) {
    ctx.warn(`grid 열은 1~100개예요: ${colsIn}`)
    cols = clamp(cols, 1, 100)
  }

  const widths: (number | null)[] = Array<number | null>(cols).fill(null)
  if (widthsIn) {
    if (widthsIn.length > cols)
      ctx.warn(`grid: widths= 값이 열 수(${cols})보다 많아서 넘친 값은 무시했어요.`)
    widthsIn.slice(0, cols).forEach((w, i) => {
      widths[i] = w
    })
    const sum = widths.reduce<number>((a, b) => a + (b ?? 0), 0)
    if (sum > PAPER_MM + 0.01)
      ctx.warn(`grid: 열 폭 합이 ${sum.toFixed(1)}mm라서 종이 폭(${PAPER_MM}mm)을 넘어요.`)
  }

  const defs: Def[] = []
  let cur: Def | null = null
  let close: number | null = null
  for (;;) {
    const raw = nextRaw(lines, pos)
    if (raw === null) break
    const t = raw.trim()
    if (t === ']') {
      close = ctx.lineBase + pos.i - 1
      break
    }
    const ind = indentOf(raw)
    const idx = pos.i - 1

    if (!DEF_RE.test(t)) {
      if (cur !== null && ind > cur.indent) {
        cur.lines.push(t)
        cur.d2 = idx
        continue
      }
      if (OPENER_RE.test(t)) {
        ctx.warn(
          `grid 안에서 "${t}"는 쓰지 않아요. col= 칸 정의를 써 주세요. 이 블록은 건너뛰었어요.`
        )
        skipBlock(lines, pos)
        cur = null
        continue
      }
      ctx.warn(
        cur !== null
          ? `글자는 칸 정의보다 한 단계 더 들여써 주세요: ${t}`
          : `알 수 없는 줄을 건너뛰었어요: ${t}`
      )
      continue
    }

    const block = /\[$/.test(t)
    const td = block ? t.replace(/\s*\[$/, '') : t
    const [head, tail] = splitColon(td)
    const label = head.trim()
    let c1 = 0
    let c2 = 0
    let r1: number | null = null
    let r2: number | null = null
    let hasCol = false
    let ok = true
    const optTokens: string[] = []
    for (const tok of tokenize(head)) {
      const rm = /^(col|row)=(\d{1,3})(?:-(\d{1,3}))?$/.exec(tok)
      if (rm) {
        let a = Number(rm[2])
        let b = rm[3] === undefined ? a : Number(rm[3])
        if (b < a) {
          ctx.warn(`${label}: 범위는 작은 수-큰 수 순서로 써 주세요. 바꿔서 읽었어요.`)
          ;[a, b] = [b, a]
        }
        if (rm[1] === 'col') {
          c1 = a
          c2 = b
          hasCol = true
        } else {
          r1 = a
          r2 = b
        }
      } else if (/^(?:col|row)=/.test(tok)) {
        ctx.warn(`${label}: 범위 모양이 틀려요. 예: col=1-3 → ${tok}`)
        ok = false
      } else {
        optTokens.push(tok)
      }
    }
    if (!hasCol) {
      ctx.warn(`${label}: col=이 없어서 이 칸은 그리지 않았어요.`)
      ok = false
    } else if (c1 < 1 || c1 > cols) {
      ctx.warn(`${label}: 열은 1~${cols}이에요. 이 칸은 그리지 않았어요.`)
      ok = false
    } else if (c2 > cols) {
      ctx.warn(`${label}: 열 범위가 ${cols}를 넘어서 ${cols}까지로 줄였어요.`)
      c2 = cols
    }
    if (r1 !== null && (r1 < 1 || (r2 ?? r1) > MAX_ROWS)) {
      ctx.warn(`${label}: row는 1~${MAX_ROWS}이에요. 이 칸은 그리지 않았어요.`)
      ok = false
    }

    const opt = parseOpts(optTokens.concat(tail === null ? [] : tokenize(tail)), ctx, label, 'cell')
    const def: Def = {
      c1,
      c2,
      r1,
      r2,
      opt,
      lines: [],
      indent: ind,
      label,
      d1: idx,
      d2: idx,
      paras: block ? [] : null
    }
    cur = def
    if (ok) defs.push(def)
    if (block) {
      const paras: { text: string; head: string; opt: Opt }[] = []
      for (;;) {
        const pr = nextRaw(lines, pos)
        if (pr === null) break
        const pt = pr.trim()
        def.d2 = pos.i - 1
        if (pt === ']') break
        if (/^text(?:\s|:|$)/.test(pt)) {
          const [ph, pv] = splitColon(pt)
          if (pv === null) {
            ctx.warn(`text에는 : 가 필요해요. 예: text center : 글자 → ${pt}`)
            continue
          }
          const hd = tokenize(ph).slice(1)
          paras.push({ text: pv.trim(), head: hd.join(' '), opt: parseOpts(hd, ctx, 'text', 'text') })
        } else {
          paras.push({ text: pt, head: '', opt: parseOpts([], ctx, 'text', 'text') })
        }
      }
      def.paras = paras
      def.lines = paras.map((p) => p.text)
      cur = null
    }
  }

  const occ: number[][] = []
  const ensureRows = (n: number): void => {
    while (occ.length < n) occ.push(Array<number>(cols).fill(-1))
  }
  const isFree = (r: number, c0: number, w: number): boolean => {
    const row = occ[r]
    if (row === undefined) return true
    for (let cc = c0; cc < c0 + w; cc++) if (row[cc] !== -1) return false
    return true
  }

  const cells: GridCell[] = []
  const hs: { r: number; rs: number; h: number }[] = []
  let curRow = 0
  for (const d of defs) {
    const w = d.c2 - d.c1 + 1
    const c0 = d.c1 - 1
    const want = d.r1 === null ? 1 : (d.r2 ?? d.r1) - d.r1 + 1
    let r: number
    if (d.r1 !== null) {
      r = d.r1 - 1
      if (!isFree(r, c0, w)) {
        ctx.warn(`${d.label}: 자리가 이미 차 있어서 그리지 않았어요.`)
        continue
      }
    } else {
      r = curRow
      while (r < MAX_ROWS && !isFree(r, c0, w)) r++
      if (r >= MAX_ROWS) {
        ctx.warn(`${d.label}: 줄이 ${MAX_ROWS}개를 넘어서 그리지 않았어요.`)
        continue
      }
    }
    let rs = 1
    while (rs < want && r + rs < MAX_ROWS && isFree(r + rs, c0, w)) rs++
    if (rs < want) ctx.warn(`${d.label}: 아래 줄이 이미 차 있어서 row 범위를 ${rs}줄로 줄였어요.`)
    ensureRows(r + rs)
    const idx = cells.length
    for (let rr = r; rr < r + rs; rr++) for (let cc = c0; cc < c0 + w; cc++) occ[rr][cc] = idx
    const text = unesc(d.lines.map((x) => fill(x, vars)).join('\n'))
    cells.push({
      r,
      c: c0,
      cs: w,
      rs,
      style: merge(pageStyle, d.opt),
      text,
      raw: d.lines.join('\n'),
      src: { def: ctx.lineBase + d.d1, end: ctx.lineBase + d.d2 },
      ord: idx,
      gridEnd: null,
      paras: d.paras
        ? d.paras.map((p) => ({
            text: unesc(fill(p.text, vars)),
            raw: p.text,
            head: p.head,
            style: merge(merge(pageStyle, d.opt), p.opt)
          }))
        : null,
    })
    if (d.opt.h !== undefined) hs.push({ r, rs, h: d.opt.h })
    curRow = r
    while (curRow < occ.length && occ[curRow].every((x) => x !== -1)) curRow++
  }

  if (rowsIn > 0 && occ.length > rowsIn)
    ctx.warn(`table: row=${rowsIn}보다 칸이 많아서 ${occ.length}줄로 그렸어요.`)
  ensureRows(Math.max(1, Math.min(rowsIn, MAX_ROWS)))
  const R = occ.length
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < cols; c++) {
      if (occ[r][c] === -1) {
        cells.push({
          r,
          c,
          cs: 1,
          rs: 1,
          style: pageStyle,
          text: '',
          raw: '',
          src: null,
          ord: -1,
          gridEnd: null,
          paras: null
        })
      }
    }
  }

  const per = Array<number | null>(R).fill(null)
  for (const x of hs) {
    const v = x.h / x.rs
    for (let rr = x.r; rr < x.r + x.rs; rr++) per[rr] = Math.max(per[rr] ?? 0, v)
  }
  const heights = per.map((v) => Math.round((v ?? DEFAULT_ROW_MM) * 100) / 100)
  const lastEnd = defs.length > 0 ? Math.max(...defs.map((d) => d.d2)) : -1
  const gridEnd = lastEnd >= 0 ? ctx.lineBase + lastEnd : null
  for (const c of cells) c.gridEnd = gridEnd
  return {
    k: 'grid',
    cols,
    frame,
    frameW,
    frameC,
    widths,
    heights,
    cells,
    endLine: gridEnd,
    head: headLine,
    close
  }
}