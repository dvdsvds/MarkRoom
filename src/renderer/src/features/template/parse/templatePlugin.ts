import type MarkdownIt from 'markdown-it'
import { MAX_LINES, OPEN_RE, OPENER_RE, VALUE_OPEN_RE } from './templateUtil'
import { envOf, parseTemplate, parseValues } from './templateParse'

type MD = InstanceType<typeof MarkdownIt>

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
export { parseTemplate } from './templateParse'

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