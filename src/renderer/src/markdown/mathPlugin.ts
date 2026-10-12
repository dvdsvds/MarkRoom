import type MarkdownIt from 'markdown-it'
import katex from 'katex'

type Md = InstanceType<typeof MarkdownIt>
type InlineRule = Parameters<Md['inline']['ruler']['push']>[1]
type BlockRule = Parameters<Md['block']['ruler']['push']>[1]
type InlineState = Parameters<InlineRule>[0]

function render(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    output: 'html',
    strict: 'ignore'
  })
}

function delim(state: InlineState, pos: number): { open: boolean; close: boolean } {
  const prev = pos > 0 ? state.src.charCodeAt(pos - 1) : -1
  const next = pos + 1 <= state.posMax ? state.src.charCodeAt(pos + 1) : -1
  return {
    open: !(next === 0x20 || next === 0x09),
    close: !(prev === 0x20 || prev === 0x09 || (next >= 0x30 && next <= 0x39))
  }
}

const mathInline: InlineRule = (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== 0x24) return false
  if (!delim(state, state.pos).open) {
    if (!silent) state.pending += '$'
    state.pos += 1
    return true
  }
  const start = state.pos + 1
  let match = start
  while ((match = state.src.indexOf('$', match)) !== -1) {
    let p = match - 1
    while (state.src[p] === '\\') p -= 1
    if ((match - p) % 2 === 1) break
    match += 1
  }
  let lineEnd = state.src.indexOf('\n', start)
  if (lineEnd === -1) lineEnd = state.posMax
  if (match > lineEnd) match = -1

  if (match === -1) {
    if (!silent) state.pending += '$'
    state.pos = start
    return true
  }
  if (match - start === 0) {
    if (!silent) state.pending += '$$'
    state.pos = start + 1
    return true
  }
  if (!delim(state, match).close) {
    if (!silent) state.pending += '$'
    state.pos = start
    return true
  }
  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.markup = '$'
    token.content = state.src.slice(start, match)
  }
  state.pos = match + 1
  return true
}

const mathBlock: BlockRule = (state, start, end, silent) => {
  let pos = state.bMarks[start] + state.tShift[start]
  let max = state.eMarks[start]
  if (pos + 2 > max || state.src.slice(pos, pos + 2) !== '$$') return false
  if (state.sCount[start] - state.blkIndent >= 4) return false
  let first = state.src.slice(pos + 2, max)
  let last = ''
  let found = false
  let next = start
  if (first.trim().endsWith('$$')) {
    first = first.trim().slice(0, -2)
    found = true
  }
  while (!found) {
    next++
    if (next >= end) break
    pos = state.bMarks[next] + state.tShift[next]
    max = state.eMarks[next]
    if (pos < max && state.tShift[next] < state.blkIndent) break
    if (state.src.slice(pos, max).trim().endsWith('$$')) {
      last = state.src.slice(pos, state.src.slice(0, max).lastIndexOf('$$'))
      found = true
    }
  }
  if (!found) return false
  if (silent) return true
  state.line = next + 1
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content =
    (first.trim() ? first + '\n' : '') + state.getLines(start + 1, next, state.tShift[start], true) + (last.trim() ? last : '')
  token.map = [start, state.line]
  token.markup = '$$'
  return true
}

export function mathPlugin(md: Md): void {
  const esc = md.utils.escapeHtml
  md.inline.ruler.after('escape', 'math_inline', mathInline)
  md.block.ruler.before('fence', 'math_block', mathBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })
  md.renderer.rules.math_inline = (tokens, i) =>
    `<span class="snote-math" data-tex="${esc(tokens[i].content)}">${render(tokens[i].content, false)}</span>`
  md.renderer.rules.math_block = (tokens, i) =>
    `<div class="snote-math snote-math-block" data-tex="${esc(tokens[i].content)}">${render(tokens[i].content, true)}</div>\n`
}