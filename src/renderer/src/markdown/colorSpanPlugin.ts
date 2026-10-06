import type { MarkdownIt, StateInline } from 'markdown-it'
import { parseColorHead, type ColorSpec } from './colorSyntax'

export function colorSpanPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('emphasis', 'colorspan', (state: StateInline, silent: boolean): boolean => {
    const src = state.src
    const start = state.pos
    if (src.charCodeAt(start) !== 0x7b /* { */) return false

    const close = src.indexOf('}', start + 1)
    if (close === -1 || close >= state.posMax) return false
    const bar = src.indexOf('|', start + 1)
    if (bar === -1 || bar > close || bar + 1 >= close) return false
    if (src.slice(start, close).includes('\n')) return false

    let head = src.slice(start + 1, bar)
    if (head.endsWith('\\')) head = head.slice(0, -1) 
    const spec = parseColorHead(head)
    if (!spec) return false

    if (!silent) {
      const open = state.push('colorspan_open', 'span', 1)
      open.meta = spec
      const oldMax = state.posMax
      state.pos = bar + 1
      state.posMax = close
      state.md.inline.tokenize(state)
      state.posMax = oldMax
      state.push('colorspan_close', 'span', -1)
    }
    state.pos = close + 1
    return true
  })

  md.renderer.rules.colorspan_open = (tokens, idx): string => {
    const { fg, bg } = tokens[idx].meta as unknown as ColorSpec
    let attrs = ''
    if (fg) attrs += ` data-fg="${md.utils.escapeHtml(fg)}"`
    if (bg) attrs += ` data-bg="${md.utils.escapeHtml(bg)}"`
    return `<span class="snote-color"${attrs}>`
  }
  md.renderer.rules.colorspan_close = (): string => '</span>'
}