import type MarkdownIt from 'markdown-it'
import type { StateBlock, StateInline } from 'markdown-it'
import { isNoteTarget, parseEmbed } from '../utils/embed'
import { wikilinkLabel } from '../utils/wikilink'

type MD = InstanceType<typeof MarkdownIt>

const BLOCK_RE = /^\s*!\[\[([^[\]\n]+)\]\]\s*$/

/**
 * `![[노트]]`, `![[img/그림.png|300]]`.
 * 여기서는 자리만 만들고, 내용은 미리보기의 useEmbeds가 채운다(다른 파일을 읽어야 해서).
 */
export function embedPlugin(md: MD): void {
  const esc = md.utils.escapeHtml

  const placeholder = (inner: string, block: boolean): string => {
    const p = parseEmbed(inner)
    if (isNoteTarget(p.target)) {
      if (!block) {
        // 문장 중간의 노트 임베드는 상자를 넣을 수 없어 링크로 보여 준다
        const label = wikilinkLabel({ note: p.target, heading: p.heading, alias: p.alias })
        const heading = p.heading ? ` data-heading="${esc(p.heading)}"` : ''
        return `<span class="wikilink" data-wikilink="${esc(p.target)}"${heading}>${esc(label)}</span>`
      }
      const heading = p.heading ? ` data-heading="${esc(p.heading)}"` : ''
      const alias = p.alias ? ` data-alias="${esc(p.alias)}"` : ''
      return `<div class="embed" data-embed-note="${esc(p.target)}"${heading}${alias}></div>\n`
    }
    const width = p.width ? ` data-width="${p.width}"` : ''
    const span = `<span class="embed-file" data-embed-file="${esc(p.target)}"${width}></span>`
    return block ? `<p>${span}</p>\n` : span
  }

  md.block.ruler.before(
    'paragraph',
    'embed_block',
    (state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean => {
      const start = state.bMarks[startLine] + state.tShift[startLine]
      const line = state.src.slice(start, state.eMarks[startLine])
      const m = BLOCK_RE.exec(line)
      if (!m) return false
      if (silent) return true
      const token = state.push('embed_block', '', 0)
      token.content = m[1].trim()
      token.map = [startLine, startLine + 1]
      state.line = startLine + 1
      return true
    }
  )

  md.inline.ruler.before('image', 'embed_inline', (state: StateInline, silent: boolean) => {
    const src = state.src
    const pos = state.pos
    if (!src.startsWith('![[', pos)) return false
    const end = src.indexOf(']]', pos + 3)
    if (end === -1) return false
    const inner = src.slice(pos + 3, end)
    if (!inner.trim() || inner.includes('[') || inner.includes('\n')) return false
    if (!silent) {
      const token = state.push('embed_inline', '', 0)
      token.content = inner.trim()
    }
    state.pos = end + 2
    return true
  })

  md.renderer.rules.embed_block = (tokens, idx) => placeholder(tokens[idx].content, true)
  md.renderer.rules.embed_inline = (tokens, idx) => placeholder(tokens[idx].content, false)
}
