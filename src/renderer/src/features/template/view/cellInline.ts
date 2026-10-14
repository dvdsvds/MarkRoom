import { splitMath, ZW } from '../../../components/mathText'
import { isMath, makeMath, texOf } from './cellMath'
import { applyInlineCss } from './templateRender'
import { fmtAttr, parseAttr, splitInline, wrapInline, type InlineOpts } from '../../../components/inlineText'

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

export interface TextChange {
  props: Record<string, string | null>
  flags: string[]
}

const FLAG_NAMES = ['bold', 'italic', 'underline', 'strike']

export function textChangeOf(ch: {
  kv?: Partial<Record<string, string | null>>
  flags?: Partial<Record<string, boolean>>
}): TextChange | null {
  const props: Record<string, string | null> = {}
  for (const k of ['fs', 'fc', 'ff']) if (ch.kv && k in ch.kv) props[k] = ch.kv[k] ?? null
  const flags = FLAG_NAMES.filter((f) => ch.flags && f in ch.flags)
  return Object.keys(props).length > 0 || flags.length > 0 ? { props, flags } : null
}

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
          nr.comparePoint(
            n.parentNode,
            Array.prototype.indexOf.call(n.parentNode.childNodes, n)
          ) === 0 &&
          nr.comparePoint(
            n.parentNode,
            Array.prototype.indexOf.call(n.parentNode.childNodes, n) + 1
          ) === 0
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
    host =
      t.parentElement && t.parentElement !== box && t.parentElement.dataset.st !== undefined
        ? t.parentElement
        : t
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
  flags: Record<string, boolean> | null
}

export function inlineAt(box: HTMLElement, r: Range): InlineState | null {
  const sc = r.startContainer
  if (!box.contains(sc)) return null
  const n =
    sc.nodeType === 1 && r.startOffset < sc.childNodes.length && !r.collapsed
      ? sc.childNodes[r.startOffset]
      : sc
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
