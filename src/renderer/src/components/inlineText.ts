/**
 * 서식 칸 글 속의 "글자 일부 스타일":  {fs=14 fc=#ff0000 bold|글자}
 * 쓸 수 있는 값: fs(1~400pt) fc(이름 색/#hex) ff(글꼴, 공백이 있으면 "따옴표") bold italic underline strike
 */
export type InlineOpts = Record<string, string>
export type InlinePiece = { text: string } | { opts: InlineOpts; inner: string }

export const INLINE_KEYS = ['fs', 'fc', 'ff', 'bold', 'italic', 'underline', 'strike'] as const
const FLAGS = ['bold', 'italic', 'underline', 'strike']
const NAMED = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const TOKEN = '[a-z]+(?:=(?:"[^"{}|]*"|[^\\s|{}"]+))?'
const HEAD = new RegExp(`^\\{((?:${TOKEN}\\s+)*${TOKEN})\\|`)

/** "fs=14 fc=#f00 bold" → 값 묶음. 못 쓰는 값이 있으면 null. */
export function parseAttr(attr: string): InlineOpts | null {
  const o: InlineOpts = {}
  for (const m of attr.matchAll(/([a-z]+)(?:=("[^"]*"|\S+))?/g)) {
    const k = m[1]
    const v = m[2] === undefined ? '' : m[2].replace(/^"|"$/g, '')
    if (FLAGS.includes(k)) {
      if (m[2] !== undefined) return null
      o[k] = ''
    } else if (k === 'fs') {
      const n = Number(v)
      if (!Number.isFinite(n) || n < 1 || n > 400) return null
      o.fs = String(Math.round(n * 10) / 10)
    } else if (k === 'fc') {
      if (!NAMED.includes(v) && !HEX.test(v)) return null
      o.fc = v
    } else if (k === 'ff') {
      const name = v
        .replace(/["\;{}<>|\r\n]/g, '')
        .trim()
        .slice(0, 60)
      if (name === '') return null
      o.ff = name
    } else return null
  }
  return Object.keys(o).length > 0 ? o : null
}

/** 값 묶음 → "fs=14 fc=#f00 bold" (순서 고정) */
export function fmtAttr(o: InlineOpts): string {
  const out: string[] = []
  for (const k of INLINE_KEYS) {
    if (!(k in o)) continue
    if (FLAGS.includes(k)) out.push(k)
    else out.push(k === 'ff' && /\s/.test(o[k]) ? `ff="${o[k]}"` : `${k}=${o[k]}`)
  }
  return out.join(' ')
}

/** 글을 일반 조각과 스타일 조각으로 나눈다. 짝이 안 맞는 { 는 그냥 글자로 둔다. */
export function splitInline(text: string): InlinePiece[] {
  const out: InlinePiece[] = []
  let plain = 0
  let i = text.indexOf('{')
  while (i !== -1) {
    const head = HEAD.exec(text.slice(i, i + 200))
    const opts = head ? parseAttr(head[1]) : null
    if (head && opts) {
      let depth = 1
      let j = i + head[0].length
      for (; j < text.length && depth > 0; j++) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
      }
      if (depth === 0) {
        if (i > plain) out.push({ text: text.slice(plain, i) })
        out.push({ opts, inner: text.slice(i + head[0].length, j - 1) })
        plain = j
        i = text.indexOf('{', j)
        continue
      }
    }
    i = text.indexOf('{', i + 1)
  }
  if (plain < text.length) out.push({ text: text.slice(plain) })
  return out
}

const balanced = (s: string): boolean => {
  let d = 0
  for (const ch of s) {
    if (ch === '{') d++
    else if (ch === '}' && --d < 0) return false
  }
  return d === 0
}

/** 스타일 글을 저장용 글자로. 줄마다 따로 감싸고, { } 짝이 안 맞으면 스타일 없이 그대로 둔다. */
export function wrapInline(opts: InlineOpts, inner: string): string {
  const attr = fmtAttr(opts)
  if (attr === '') return inner
  return inner
    .split('\n')
    .map((line) => (line.trim() === '' || !balanced(line) ? line : `{${attr}|${line}}`))
    .join('\n')
}

/** 스타일 표시를 모두 벗긴 글 (배분 정렬처럼 글자만 필요할 때) */
export const plainInline = (text: string): string =>
  splitInline(text)
    .map((p) => ('opts' in p ? p.inner : p.text))
    .join('')
