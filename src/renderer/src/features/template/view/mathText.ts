import katex from 'katex'

export const ZW = '​'

const MATH_SRC = String.raw`\$([^\s$]|[^\s$][^$\n]*?[^\s$])\$(?!\d)`
export const mathRe = (): RegExp => new RegExp(MATH_SRC, 'g')

export type Piece = { text: string } | { tex: string }

export function splitMath(raw: string): Piece[] {
  const out: Piece[] = []
  let last = 0
  for (const m of raw.matchAll(mathRe())) {
    const at = m.index ?? 0
    if (at > last) out.push({ text: raw.slice(last, at) })
    out.push({ tex: m[1] })
    last = at + m[0].length
  }
  if (last < raw.length) out.push({ text: raw.slice(last) })
  return out
}

export function renderMath(target: HTMLElement, tex: string): void {
  target.dataset.tex = tex
  try {
    katex.render('\\displaystyle ' + tex, target, {
      displayMode: false,
      throwOnError: false,
      output: 'html',
      strict: 'ignore'
    })
  } catch {
    target.textContent = `$${tex}$`
  }
}
