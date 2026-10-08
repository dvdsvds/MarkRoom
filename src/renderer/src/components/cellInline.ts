import { splitMath, ZW } from './mathText'
import { isMath, makeMath, texOf } from './cellMath'
import { applyInlineCss } from './templateRender'
import { fmtAttr, parseAttr, splitInline, wrapInline, type InlineOpts } from './inlineText'

/**
 * 칸 편집 상자(.tq-text)의 내용 ↔ 글 변환과 "글자 일부 스타일" 적용.
 * 편집 상자 안 모양: 글 조각 / 첨자 span[data-s] / 수식 math-field / 스타일 span[data-st]
 * 스타일 span 은 항상 자식이 하나뿐이고(글 한 조각, 첨자 하나, 수식 하나), 서로 겹치지 않는다.
 */
const ZWRE = /​/g

export function styleScript(sp: HTMLElement, kind: 'sup' | 'sub'): void {
  sp.dataset.s = kind
  const st = sp.style
  st.fontSize = '0.7em'
  st.lineHeight = '0'
  st.verticalAlign = 'baseline'
  st.position = 'relative'
  st.top = kind === 'sup' ? '-0.45em' : '0.12em'
}

export function mkScript(kind: 'sup' | 'sub', text: string): HTMLElement {
  const sp = document.createElement('span')
  sp.textContent = text
  styleScript(sp, kind)
  return sp
}

const wrapMark = (t: string, kind: 'sup' | 'sub'): string => {
  const mark = kind === 'sup' ? '^' : '~'
  return t
    .split(/(\s+)/)
    .map((p) => (p === '' || /^\s+$/.test(p) ? p : mark + p + mark))
    .join('')
}

const runOf = (n: Node | null | undefined): HTMLElement | null =>
  n instanceof HTMLElement && n.dataset.st !== undefined ? n : null

function setRun(sp: HTMLElement, o: InlineOpts): void {
  sp.dataset.st = fmtAttr(o)
  sp.style.cssText = ''
  applyInlineCss(sp, o)
}

function wrapRun(node: Node, o: InlineOpts): HTMLElement {
  const sp = document.createElement('span')
  setRun(sp, o)
  node.parentNode?.replaceChild(sp, node)
  sp.append(node)
  return sp
}

/** 수식·첨자를 담은 글 조각들을 into 에 채운다. */
function fillPlain(into: HTMLElement, raw: string): void {
  for (const piece of splitMath(raw)) {
    if ('tex' in piece) {
      into.append(makeMath(piece.tex))
      continue
    }
    const text = piece.text
    const re = /\^([^\s^]+)\^|~([^\s~]+)~/g
    let last = 0
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (m.index > last) into.append(text.slice(last, m.index))
      const sup = m[1] !== undefined
      into.append(mkScript(sup ? 'sup' : 'sub', sup ? m[1] : m[2]))
      last = m.index + m[0].length
    }
    if (last < text.length) into.append(text.slice(last))
  }
}

/** 저장된 글 → 편집 상자 */
export function fillCell(box: HTMLElement, raw: string): void {
  box.replaceChildren()
  for (const p of splitInline(raw)) {
    if (!('opts' in p)) {
      fillPlain(box, p.text)
      continue
    }
    const tmp = document.createElement('div')
    fillPlain(tmp, p.inner)
    for (const n of Array.from(tmp.childNodes)) {
      const sp = document.createElement('span')
      setRun(sp, p.opts)
      box.append(sp)
      sp.append(n)
    }
  }
}

/** 편집 상자 → 저장할 글 */
export function serializeCell(box: HTMLElement): string {
  const ser = (nodes: Node[]): string => {
    let out = ''
    for (let i = 0; i < nodes.length; i++) {
      const c = nodes[i]
      const run = runOf(c)
      if (run) {
        const st = run.dataset.st as string
        let inner = ''
        let j = i
        for (; j < nodes.length; j++) {
          const r = runOf(nodes[j])
          if (!r || r.dataset.st !== st) break
          inner += ser(Array.from(r.childNodes))
        }
        const o = parseAttr(st)
        out += o ? wrapInline(o, inner) : inner
        i = j - 1
        continue
      }
      if (c.nodeType === Node.TEXT_NODE) out += (c.nodeValue ?? '').replace(ZWRE, '')
      else if (isMath(c)) {
        const t = texOf(c)
        if (!t) continue
        out += '$' + t + '$'
        // 닫는 $ 바로 뒤가 숫자면 수식으로 안 읽히므로 한 칸 띄운다
        const nx = nodes[i + 1]
        if (nx && nx.nodeType === Node.TEXT_NODE && /^​*\d/.test(nx.nodeValue ?? '')) out += ' '
      } else if (c instanceof HTMLElement) {
        if (c.tagName === 'BR') out += '\n'
        else if (c.dataset.s === 'sup' || c.dataset.s === 'sub')
          out += wrapMark((c.textContent ?? '').replace(ZWRE, ''), c.dataset.s)
        else out += ser(Array.from(c.childNodes))
      }
    }
    return out
  }
  return ser(Array.from(box.childNodes)).replace(/\n$/, '')
}

// ───────── 글자 일부 스타일 ─────────

export interface TextChange {
  /** 값을 정하는 것(fs/fc/ff). null 이면 그 스타일을 지운다. */
  props: Record<string, string | null>
  /** 켜고 끄는 것(bold/italic/underline/strike). 고른 글이 전부 켜져 있으면 끈다. */
  flags: string[]
}

const FLAG_NAMES = ['bold', 'italic', 'underline', 'strike']

/** 툴바 변경에서 글자 스타일 부분만 뽑는다. 칸 전체용 변경이면 null. */
export function textChangeOf(ch: {
  kv?: Partial<Record<string, string | null>>
  flags?: Partial<Record<string, boolean>>
}): TextChange | null {
  const props: Record<string, string | null> = {}
  for (const k of ['fs', 'fc', 'ff']) if (ch.kv && k in ch.kv) props[k] = ch.kv[k] ?? null
  const flags = FLAG_NAMES.filter((f) => ch.flags && f in ch.flags)
  return Object.keys(props).length > 0 || flags.length > 0 ? { props, flags } : null
}

/** 한 span 에 자식이 둘 이상이면 자식마다 span 을 따로 둔다. */
function splitRuns(box: HTMLElement): void {
  for (const sp of Array.from(box.querySelectorAll<HTMLElement>('[data-st]'))) {
    const kids = Array.from(sp.childNodes)
    for (const k of kids.slice(1)) {
      const w = sp.cloneNode(false) as HTMLElement
      sp.after(w)
      w.append(k)
    }
  }
}

/** 고른 범위(r)의 글자에 스타일을 적용한다. 적용한 범위를 돌려주고, 고른 글자가 없으면 null. */
export function applyInline(box: HTMLElement, r: Range, ch: TextChange): Range | null {
  splitRuns(box)
  const sc = r.startContainer
  const so = r.startOffset
  const ec = r.endContainer
  const eo = r.endOffset
  if (ec.nodeType === 3 && eo > 0 && eo < (ec as Text).length) (ec as Text).splitText(eo)
  let startNode: Node = sc
  let startSplit = false
  if (sc.nodeType === 3 && so > 0 && so < (sc as Text).length) {
    startNode = (sc as Text).splitText(so)
    startSplit = true
  }
  const nr = document.createRange()
  if (startSplit) nr.setStart(startNode, 0)
  else nr.setStart(sc, so)
  if (startSplit && sc === ec) nr.setEnd(startNode, (startNode as Text).length)
  else nr.setEnd(ec, eo)

  const inside = (n: Node): boolean => {
    const len = n.nodeType === 3 ? (n as Text).length : n.childNodes.length
    return n.nodeType === 3
      ? nr.comparePoint(n, 0) === 0 && nr.comparePoint(n, len) === 0
      : !!n.parentNode &&
          nr.comparePoint(n.parentNode, Array.prototype.indexOf.call(n.parentNode.childNodes, n)) === 0 &&
          nr.comparePoint(n.parentNode, Array.prototype.indexOf.call(n.parentNode.childNodes, n) + 1) === 0
  }
  const found: Node[] = []
  const walk = (n: Node): void => {
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType === 3) {
        if ((c.nodeValue ?? '').replace(ZWRE, '') !== '' && inside(c)) found.push(c)
      } else if (isMath(c)) {
        if (inside(c)) found.push(c)
      } else if (c instanceof HTMLElement) walk(c)
    }
  }
  walk(box)
  // 첨자 안의 글자는 첨자 span 통째로 한 덩어리로 본다
  const units: Node[] = []
  for (const n of found) {
    let u: Node = n
    for (let p = n.parentElement; p && p !== box; p = p.parentElement) if (p.dataset.s) u = p
    if (!units.includes(u)) units.push(u)
  }
  if (units.length === 0) return null

  const runAround = (u: Node): HTMLElement | null => {
    const p = u.parentElement
    return p && p !== box && p.dataset.st !== undefined ? p : null
  }
  const optsOf = (u: Node): InlineOpts => parseAttr(runAround(u)?.dataset.st ?? '') ?? {}
  const turnOn = new Map<string, boolean>()
  for (const f of ch.flags) turnOn.set(f, !units.every((u) => f in optsOf(u)))

  const tops: Node[] = []
  for (const u of units) {
    const o = optsOf(u)
    for (const [k, v] of Object.entries(ch.props)) {
      if (v === null) delete o[k]
      else o[k] = v
    }
    for (const f of ch.flags) {
      if (turnOn.get(f)) o[f] = ''
      else delete o[f]
    }
    let w = runAround(u)
    if (Object.keys(o).length === 0) {
      if (w) {
        w.replaceWith(u)
      }
      tops.push(u)
      continue
    }
    if (!w) w = wrapRun(u, o)
    else setRun(w, o)
    tops.push(w)
  }
  const out = document.createRange()
  out.setStartBefore(tops[0])
  out.setEndAfter(tops[tops.length - 1])
  return out
}

/**
 * 커서만 있을 때(글자를 고르지 않았을 때): 커서 자리에 빈 스타일 span 을 만들어 그 안에 커서를 둔다.
 * 이어서 치는 글자가 그 스타일이 된다. 이미 빈 스타일 span 안이면 그 span 의 스타일을 바꾼다.
 * 첨자 안이면 null.
 */
export function applyCaret(box: HTMLElement, r: Range, ch: TextChange): Range | null {
  splitRuns(box)
  const sc = r.startContainer
  const el = sc instanceof Element ? sc : sc.parentElement
  const sup = el?.closest<HTMLElement>('[data-s]')
  if (sup && box.contains(sup)) return null
  let run = el?.closest<HTMLElement>('[data-st]') ?? null
  if (run && !box.contains(run)) run = null

  const edit = (base: InlineOpts): InlineOpts => {
    const o = { ...base }
    for (const [k, v] of Object.entries(ch.props)) {
      if (v === null) delete o[k]
      else o[k] = v
    }
    for (const f of ch.flags) {
      if (f in o) delete o[f]
      else o[f] = ''
    }
    return o
  }
  const caretAt = (n: Node, off: number): Range => {
    const out = document.createRange()
    out.setStart(n, off)
    out.collapse(true)
    return out
  }

  // 이미 비어 있는 스타일 span 안: 그 스타일만 바꾼다
  if (run && (run.textContent ?? '').replace(ZWRE, '') === '' && !run.querySelector('math-field')) {
    const o = edit(parseAttr(run.dataset.st ?? '') ?? {})
    let t = run.firstChild
    if (!t || t.nodeType !== 3) {
      t = document.createTextNode(ZW)
      run.replaceChildren(t)
    }
    if (Object.keys(o).length === 0) {
      run.replaceWith(t)
    } else setRun(run, o)
    return caretAt(t, (t as Text).length)
  }

  const base = run ? (parseAttr(run.dataset.st ?? '') ?? {}) : {}
  const o = edit(base)
  // 커서 자리를 정한다: 기준 조각(unit)의 앞/뒤, 또는 상자 안 위치
  let host: Node | null = null
  let where: 'before' | 'after' | 'child' = 'after'
  let childRef: Node | null = null
  if (sc.nodeType === 3) {
    const t = sc as Text
    const off = r.startOffset
    if (off > 0 && off < t.length) {
      t.splitText(off)
      splitRuns(box)
      where = 'after'
    } else where = off === 0 ? 'before' : 'after'
    host = t.parentElement && t.parentElement !== box && t.parentElement.dataset.st !== undefined ? t.parentElement : t
  } else {
    host = sc
    where = 'child'
    childRef = sc.childNodes[r.startOffset] ?? null
  }
  if (Object.keys(o).length === 0) return caretAt(sc, r.startOffset)
  const tn = document.createTextNode(ZW)
  const w = document.createElement('span')
  setRun(w, o)
  w.append(tn)
  if (where === 'child') (host as Node).insertBefore(w, childRef)
  else if (where === 'before') (host as Element).before(w)
  else (host as Element).after(w)
  return caretAt(tn, 1)
}

export interface InlineState {
  fs: string | null
  fc: string | null
  ff: string | null
  /** 스타일 span 안이면 그 글의 굵게·기울임·밑줄·취소선 상태. 밖이면 null. */
  flags: Record<string, boolean> | null
}

/** 커서·선택(r) 자리의 스타일. 스타일 span 이 없으면 각 값은 null. */
export function inlineAt(box: HTMLElement, r: Range): InlineState | null {
  const sc = r.startContainer
  if (!box.contains(sc)) return null
  // 범위가 span 앞에서 시작하면(startContainer 가 상자) 그 자리의 글자 조각을 기준으로 본다
  const n = sc.nodeType === 1 && r.startOffset < sc.childNodes.length && !r.collapsed ? sc.childNodes[r.startOffset] : sc
  const el = n instanceof Element ? n : n.parentElement
  const run = el?.closest<HTMLElement>('[data-st]') ?? null
  const o = run && box.contains(run) ? parseAttr(run.dataset.st ?? '') : null
  return {
    fs: o?.fs ?? null,
    fc: o?.fc ?? null,
    ff: o?.ff ?? null,
    flags: o ? Object.fromEntries(FLAG_NAMES.map((f) => [f, f in o])) : null
  }
}