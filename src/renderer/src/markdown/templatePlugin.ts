import type MarkdownIt from 'markdown-it'
import { parseBlock, splitCells } from './blockPlugin'
import type {
  FrameKind,
  GridCell,
  LineKind,
  Opt,
  ParsedTemplate,
  Style,
  TNode,
} from './templateTypes'
import {
  DEFAULT_ROW_MM,
  DEFAULT_STYLE,
  DEF_RE,
  EDGE_KINDS,
  MAX_DEPTH,
  MAX_LINES,
  MAX_ROWS,
  OPENER_RE,
  OPEN_RE,
  PAPER_MM,
  VALUE_OPEN_RE,
  VAR_RE,
  clamp,
  fill,
  indentOf,
  nextRaw,
  num,
  skipBlock,
  splitColon,
  tokenize,
  unesc,
} from './templateUtil'
import { Ctx, merge, parseEdgeValue, parseOpts } from './templateOpts'


export type {
  Align,
  VAlign,
  LineKind,
  EdgeKind,
  FrameKind,
  Sides,
  Edges,
  EdgeExtra,
  Diag,
  Style,
  GridCell,
  TNode,
  ParsedTemplate
} from './templateTypes'

type MD = InstanceType<typeof MarkdownIt>

/** 한 번 렌더링하는 동안 문서 전체가 공유하는 상태. */
type Env = {
  vars: Map<string, string>
  valueSeen: boolean
  templates: number
  pageBase: Style | null
}

function envOf(env: unknown): Env {
  const e = env as { snote?: Env }
  if (!e.snote) e.snote = { vars: new Map(), valueSeen: false, templates: 0, pageBase: null }
  return e.snote
}

/** value [ ] 안의 "이름: 값" 줄을 읽는다. 겹친 이름은 에러로 알리고 값을 쓰지 않는다. */
function parseValues(lines: { text: string; no: number }[], env: Env): string[] {
  const errors: string[] = []
  const found = new Map<string, number[]>()
  const vals = new Map<string, string>()
  for (const { text, no } of lines) {
    if (text === '') continue
    const m = VAR_RE.exec(text)
    if (!m) {
      errors.push(`value ${no}번째 줄: 이름: 값 모양으로 써 주세요 → ${text}`)
      continue
    }
    const list = found.get(m[1]) ?? []
    list.push(no)
    found.set(m[1], list)
    vals.set(m[1], m[2].trim())
  }
  for (const [name, nos] of found) {
    if (nos.length > 1) {
      errors.push(`value: ${name} 이름이 겹쳐요 (${nos.map((n) => `${n}번째 줄`).join(', ')})`)
    } else {
      env.vars.set(name, vals.get(name) as string)
    }
  }
  return errors
}

function findPage(lines: string[]): string | null {
  let depth = 0
  for (const raw of lines) {
    const t = raw.trim()
    if (t === '') continue
    if (OPENER_RE.test(t)) depth++
    else if (t === ']') depth = Math.max(0, depth - 1)
    else if (depth === 0 && /^page(?:\s|=|$)/.test(t)) return t
  }
  return null
}

/** page A4 / page=2 A4 옵션… 번호는 선택이고, 쓰면 몇 번째 template인지와 맞는지 검사한다. */
function parsePage(t: string, ctx: Ctx, base: Style, index: number): Style {
  const toks = tokenize(t)
  const m = /^page(?:=(\d{1,3}))?$/.exec(toks[0])
  if (!m) {
    ctx.warn(`page 모양이 틀려요. 예: page=1 A4 → ${toks[0]}`)
    return base
  }
  if (m[1] !== undefined && Number(m[1]) !== index) {
    ctx.warn(`page=${m[1]}은 맞지 않아요. 이 template은 ${index}쪽이에요.`)
  }
  let rest = toks.slice(1)
  if (rest.length > 0 && /^A\d$/i.test(rest[0])) {
    if (rest[0].toUpperCase() !== 'A4') ctx.warn(`page는 A4만 지원해요: ${rest[0]}`)
    rest = rest.slice(1)
  }
  return merge(base, parseOpts(rest, ctx, 'page', 'page'))
}

function parseTable(
  lines: string[],
  pos: { i: number },
  vars: Map<string, string>,
  ctx: Ctx
): TNode {
  const raw: string[][] = []
  for (;;) {
    const line = nextRaw(lines, pos)
    if (line === null) break
    const t = line.trim()
    if (t === ']') break
    raw.push(splitCells(t).map((c) => fill(c, vars)))
  }
  if (raw.length === 0) {
    ctx.warn('table: 내용이 없어요. 첫 줄은 머리글이에요.')
    return { k: 'table', columns: [''], rows: [] }
  }
  let columns = raw[0]
  if (columns.length > 12) {
    ctx.warn('table: 열은 12개까지예요. 넘친 열은 잘랐어요.')
    columns = columns.slice(0, 12)
  }
  let rows = raw.slice(1)
  if (rows.length > 200) {
    ctx.warn('table: 데이터는 200줄까지예요. 넘친 줄은 잘랐어요.')
    rows = rows.slice(0, 200)
  }
  return { k: 'table', columns, rows: rows.map((r) => columns.map((_, c) => r[c] ?? '')) }
}

/** widths=20,30,-,40 → [20, 30, null, 40]. - 는 남은 폭을 나눠 갖는 열. */
function parseWidths(val: string, ctx: Ctx): (number | null)[] | null {
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
}

function parseGrid(
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
  headLine: number
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

    const [head, tail] = splitColon(t)
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
    cur = { c1, c2, r1, r2, opt, lines: [], indent: ind, label, d1: idx, d2: idx }
    if (ok) defs.push(cur)
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
      gridEnd: null
    })
    if (d.opt.h !== undefined) hs.push({ r, rs, h: d.opt.h })
    curRow = r
    while (curRow < occ.length && occ[curRow].every((x) => x !== -1)) curRow++
  }

  if (occ.length === 0) ensureRows(1)
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
          gridEnd: null
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

function parseNodes(
  lines: string[],
  pos: { i: number },
  vars: Map<string, string>,
  ctx: Ctx,
  pageStyle: Style,
  top: boolean,
  depth: number
): TNode[] {
  const out: TNode[] = []
  for (;;) {
    const raw = nextRaw(lines, pos)
    if (raw === null) return out
    const t = raw.trim()
    if (t === ']') {
      if (top) {
        ctx.warn('짝이 없는 ]를 건너뛰었어요.')
        continue
      }
      return out
    }
    if (/^page(?:\s|=|$)/.test(t)) {
      if (!top) ctx.warn('page는 template 맨 바깥에서만 쓸 수 있어요. 무시했어요.')
      continue
    }
    let m = /^line(?:(?:\s+|\s*=\s*)(solid|double|dashed|thick))?$/.exec(t)
    if (m) {
      out.push({ k: 'line', kind: (m[1] as LineKind | undefined) ?? 'solid' })
      continue
    }
    m = /^space(?:(?:\s+|\s*=\s*)(\d{1,2}))?$/.exec(t)
    if (m) {
      out.push({ k: 'space', n: clamp(Number(m[1] ?? 1), 1, 20) })
      continue
    }
    if (/^text(?:\s|:|$)/.test(t)) {
      const [head, tail] = splitColon(t)
      if (tail === null) {
        ctx.warn(`text에는 : 가 필요해요. 예: text center : 글자 → ${t}`)
        continue
      }
      const opt = parseOpts(tokenize(head).slice(1), ctx, 'text', 'text')
      out.push({
        k: 'text',
        text: unesc(fill(tail.trim(), vars)),
        style: merge(pageStyle, opt),
        line: ctx.lineBase + pos.i - 1,
        raw: tail.trim()
      })
      continue
    }
    if (OPENER_RE.test(t)) {
      const head = tokenize(t.replace(/\[$/, '').trim())
      const name = head[0] ?? ''
      if (name === 'value' || name === 'template') {
        ctx.warn(`${name}는 template 안에서 쓸 수 없어요. 이 블록은 건너뛰었어요.`)
        skipBlock(lines, pos)
        continue
      }
      if (depth >= MAX_DEPTH) {
        ctx.warn('중첩은 4단계까지예요. 이 블록은 건너뛰었어요.')
        skipBlock(lines, pos)
        continue
      }
      const gm = /^grid=(\d{1,3})$/.exec(name)
      if (name === 'box') {
        out.push({
          k: 'box',
          children: parseNodes(lines, pos, vars, ctx, pageStyle, false, depth + 1)
        })
      } else if (name === 'chart') {
        const body: string[] = []
        for (;;) {
          const l = nextRaw(lines, pos)
          if (l === null) break
          const x = l.trim()
          if (x === ']') break
          body.push(x)
        }
        const r = parseBlock('chart', body)
        if ('error' in r) ctx.warn(r.error)
        else out.push({ k: 'block', block: r.block })
      } else if (name === 'table') {
        out.push(parseTable(lines, pos, vars, ctx))
      } else if (gm) {
        let frame: FrameKind = 'solid'
        let frameW: number | null = null
        let frameC: string | null = null
        let widthsIn: (number | null)[] | null = null
        for (const tok of head.slice(1)) {
          const fm = /^frame=(.+)$/.exec(tok)
          const wm = /^widths=(.+)$/.exec(tok)
          if (fm) {
            const v = parseEdgeValue(fm[1], EDGE_KINDS)
            if (typeof v === 'string') ctx.warn(`grid: frame= ${v}: ${fm[1]}`)
            else {
              frame = v.kind as FrameKind
              frameW = v.w
              frameC = v.c
            }
          } else if (wm) widthsIn = parseWidths(wm[1], ctx)
          else ctx.warn(`grid: 모르는 옵션이에요 (frame=, widths=): ${tok}`)
        }
        const headLine = ctx.lineBase + pos.i - 1
        out.push(
          parseGrid(
            lines,
            pos,
            vars,
            ctx,
            Number(gm[1]),
            frame,
            frameW,
            frameC,
            widthsIn,
            pageStyle,
            headLine
          )
        )
      } else {
        ctx.warn(`옛 문법은 읽지 않아요. grid=12 [ 처럼 써 주세요. 이 블록은 건너뛰었어요: ${t}`)
        skipBlock(lines, pos)
      }
      continue
    }
    ctx.warn(`알 수 없는 줄을 건너뛰었어요: ${t}`)
  }
}

export function parseTemplate(
  lines: string[],
  vars: Map<string, string>,
  index = 1,
  base: Style | null = null,
  lineBase = 1
): ParsedTemplate {
  const ctx = new Ctx()
  ctx.lineBase = lineBase
  try {
    const baseStyle = base ?? DEFAULT_STYLE
    const pageLine = findPage(lines)
    const page = pageLine === null ? baseStyle : parsePage(pageLine, ctx, baseStyle, index)
    const nodes = parseNodes(lines, { i: 0 }, vars, ctx, page, true, 0)
    return { page, nodes, warnings: ctx.warnings, close: lineBase + lines.length }
  } catch {
    return { error: 'template: 읽을 수 없어요.' }
  }
}

export function templatePlugin(md: MD): void {
  md.block.ruler.before(
    'fence',
    'snote_value',
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false
      const rawText = (n: number): string =>
        state.src.slice(state.bMarks[n], state.eMarks[n]).replace(/\t/g, '  ')
      if (!VALUE_OPEN_RE.test(rawText(startLine).trim())) return false

      const lines: { text: string; no: number }[] = []
      let next = startLine + 1
      let closed = false
      for (; next < endLine; next++) {
        const t = rawText(next).trim()
        if (t === ']') {
          closed = true
          break
        }
        lines.push({ text: t, no: next + 1 })
        if (lines.length > MAX_LINES) return false
      }
      if (!closed) return false
      if (silent) return true

      const env = envOf(state.env)
      const at = startLine + 1
      let errors: string[]
      if (env.valueSeen) {
        errors = [`value 블록은 하나만 쓸 수 있어요 (${at}번째 줄). 첫 번째 value만 읽어요.`]
      } else {
        env.valueSeen = true
        errors =
          env.templates > 0
            ? [`value는 template보다 앞에 써 주세요 (${at}번째 줄). 이 value는 읽지 않아요.`]
            : parseValues(lines, env)
      }

      const token = state.push('snote_value', 'div', 0)
      token.block = true
      token.map = [startLine, next + 1]
      token.meta = { errors }
      state.line = next + 1
      return true
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] }
  )

  md.block.ruler.before(
    'fence',
    'snote_template',
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false
      const rawText = (n: number): string =>
        state.src.slice(state.bMarks[n], state.eMarks[n]).replace(/\t/g, '  ')
      if (!OPEN_RE.test(rawText(startLine).trim())) return false

      const lines: string[] = []
      let depth = 1
      let next = startLine + 1
      let closed = false
      for (; next < endLine; next++) {
        const line = rawText(next)
        const t = line.trim()
        if (OPENER_RE.test(t)) depth++
        else if (t === ']') {
          depth--
          if (depth === 0) {
            closed = true
            break
          }
        }
        lines.push(line)
        if (lines.length > MAX_LINES) return false
      }
      if (!closed) return false
      if (silent) return true

      const env = envOf(state.env)
      env.templates += 1
      const token = state.push('snote_template', 'div', 0)
      token.block = true
      token.map = [startLine, next + 1]
      token.meta = { lines, index: env.templates, line0: startLine }
      state.line = next + 1
      return true
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] }
  )

  md.renderer.rules.snote_value = (tokens, idx) => {
    const { errors } = tokens[idx].meta as { errors: string[] }
    if (errors.length === 0) return ''
    const msg = errors.map((e) => md.utils.escapeHtml(e)).join('<br>')
    return `<div class="code-run-out error">${msg}</div>\n`
  }

  md.renderer.rules.snote_template = (tokens, idx, _options, env) => {
    const { lines, index, line0 } = tokens[idx].meta as {
      lines: string[]
      index: number
      line0: number
    }
    const st = envOf(env)
    const result = parseTemplate(lines, st.vars, index, st.pageBase, line0 + 2)
    if (index === 1 && 'page' in result) st.pageBase = result.page
    const spec = md.utils.escapeHtml(JSON.stringify(result))
    return `<div class="snote-template" data-spec="${spec}"></div>\n`
  }
}
