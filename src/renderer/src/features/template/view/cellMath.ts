import { MathfieldElement } from 'mathlive'
import { ZW } from '../../../components/mathText'

let ready = false
function setup(): void {
  if (ready) return
  ready = true
  MathfieldElement.fontsDirectory = null
  MathfieldElement.soundsDirectory = null
}

export const isMath = (n: Node | null | undefined): n is MathfieldElement =>
  !!n && n.nodeType === 1 && (n as Element).tagName === 'MATH-FIELD'

export function makeMath(tex: string): MathfieldElement {
  setup()
  const mf = new MathfieldElement()
  mf.mathVirtualKeyboardPolicy = 'manual'
  mf.className = 'tq-mf'
  mf.value = tex
  mf.addEventListener('move-out', (ev) => {
    const box = mf.closest<HTMLElement>('.tq-text')
    if (!box) return
    ev.preventDefault()
    const d = (ev as CustomEvent<{ direction: string }>).detail.direction
    leaveMath(box, mf, d === 'forward' || d === 'downward' ? 1 : -1)
  })
  return mf
}

const PLACEHOLDER = /\\placeholder(?:\[[^\]]*\])?\{([^{}]*)\}/g

export function texOf(mf: MathfieldElement): string {
  return mf.value
    .replace(PLACEHOLDER, (_all, inner: string) => (inner.trim() === '' ? '\\square' : inner))
    .replace(/\s*\n\s*/g, ' ')
    .trim()
}

const emptyText = (n: Node | null): boolean =>
  !!n && n.nodeType === 3 && (n.nodeValue ?? '').replace(/​/g, '') === ''

export function mathBeside(box: HTMLElement, dir: 1 | -1): MathfieldElement | null {
  const s = window.getSelection()
  if (!s || !s.isCollapsed || !s.anchorNode || !box.contains(s.anchorNode)) return null
  const node = s.anchorNode
  const off = s.anchorOffset
  let cand: Node | null
  if (node.nodeType === 3) {
    const v = node.nodeValue ?? ''
    const rest = dir > 0 ? v.slice(off) : v.slice(0, off)
    if (rest.replace(/​/g, '') !== '') return null
    cand = dir > 0 ? node.nextSibling : node.previousSibling
  } else {
    cand = dir > 0 ? (node.childNodes[off] ?? null) : (node.childNodes[off - 1] ?? null)
  }
  while (emptyText(cand)) cand = dir > 0 ? cand!.nextSibling : cand!.previousSibling
  return isMath(cand) ? cand : null
}

export function enterMath(mf: MathfieldElement, at: 'start' | 'end'): void {
  mf.focus()
  mf.executeCommand(at === 'start' ? 'moveToMathfieldStart' : 'moveToMathfieldEnd')
}

export function leaveMath(box: HTMLElement, mf: MathfieldElement, dir: 1 | -1): void {
  let t: Node | null = dir > 0 ? mf.nextSibling : mf.previousSibling
  if (!t || t.nodeType !== 3) {
    t = document.createTextNode(ZW)
    if (dir > 0) mf.after(t)
    else mf.before(t)
  }
  box.focus()
  const r = document.createRange()
  const len = (t.nodeValue ?? '').length
  r.setStart(t, dir > 0 ? Math.min(len, (t.nodeValue ?? '').startsWith(ZW) ? 1 : 0) : len)
  r.collapse(true)
  const s = window.getSelection()
  s?.removeAllRanges()
  s?.addRange(r)
}

export function insertMath(box: HTMLElement, latex = ''): MathfieldElement | null {
  const s = window.getSelection()
  if (!s || s.rangeCount === 0 || !box.contains(s.anchorNode)) return null
  const r = s.getRangeAt(0)
  r.deleteContents()
  const mf = makeMath('')
  r.insertNode(mf)
  const after = document.createTextNode(ZW)
  mf.after(after)
  if (!mf.previousSibling || mf.previousSibling.nodeType !== 3)
    mf.before(document.createTextNode(ZW))
  mf.focus()
  if (latex) mf.insert(latex, { selectionMode: 'placeholder' })
  return mf
}
