import katex from 'katex'

/** 칸 글자 안의 수식($...$) 해석과 그리기. 편집용 수식 상자는 cellMath.ts. */

export const ZW = '​'

// 본문 수식과 같은 규칙: 여는 $ 뒤가 공백이면 안 되고, 닫는 $ 앞이 공백이거나 뒤가 숫자면 수식이 아니다.
const MATH_SRC = String.raw`\$([^\s$]|[^\s$][^$\n]*?[^\s$])\$(?!\d)`
export const mathRe = (): RegExp => new RegExp(MATH_SRC, 'g')

export type Piece = { text: string } | { tex: string }

/** 글을 [글자, 수식, 글자, …] 조각으로 나눈다. */
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

/** 평소 보기용: KaTeX로 그린다. */
export function renderMath(target: HTMLElement, tex: string): void {
  target.dataset.tex = tex
  try {
    // 칸 안에서는 편집 상자와 같은 모양이 되도록 \displaystyle 로 그린다(극한의 x→0이 lim 아래로 간다)
    katex.render('\\displaystyle ' + tex, target, { displayMode: false, throwOnError: false, output: 'html', strict: 'ignore' })
  } catch {
    target.textContent = `$${tex}$`
  }
}