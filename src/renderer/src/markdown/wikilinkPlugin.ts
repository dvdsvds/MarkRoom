import type { MarkdownIt, StateInline } from 'markdown-it'
import { parseWikilink, wikilinkLabel } from '../utils/wikilink'

export function wikilinkPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('link', 'wikilink', (state: StateInline, silent: boolean): boolean => {
    const start = state.pos
    const src = state.src
    if (src.charCodeAt(start) !== 0x5b /* [ */ || src.charCodeAt(start + 1) !== 0x5b) {
      return false
    }
    const end = src.indexOf(']]', start + 2)
    if (end === -1) return false

    const content = src.slice(start + 2, end)
    if (content.length === 0 || content.includes('[') || content.includes('\n')) return false

    if (!silent) {
      const token = state.push('wikilink', '', 0)
      token.content = content.trim()
    }
    state.pos = end + 2
    return true
  })

  md.renderer.rules.wikilink = (tokens, idx): string => {
    const raw = tokens[idx].content
    const parts = parseWikilink(raw)
    const esc = md.utils.escapeHtml
    const heading = parts.heading ? ` data-heading="${esc(parts.heading)}"` : ''
    return `<span class="wikilink" data-wikilink="${esc(parts.note)}"${heading} title="${esc(`[[${raw}]]`)}">${esc(wikilinkLabel(parts))}</span>`
  }
}
