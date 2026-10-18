import type MarkdownIt from 'markdown-it'
import type { Token } from 'markdown-it'
import { CALLOUT_HEAD_RE, calloutIconSvg, findCalloutType, CALLOUT_TYPES } from '../utils/callout'

type MD = InstanceType<typeof MarkdownIt>

interface CalloutMeta {
  type: string
  color: string
  titleHtml: string
  iconHtml: string
  /** '' 접기 없음, '+' 펼친 채 시작, '-' 접힌 채 시작 */
  fold: '' | '+' | '-'
}

/** 같은 깊이의 blockquote_close 위치 */
function findClose(tokens: Token[], openIndex: number): number {
  const level = tokens[openIndex].level
  for (let i = openIndex + 1; i < tokens.length; i++) {
    if (tokens[i].type === 'blockquote_close' && tokens[i].level === level) return i
  }
  return -1
}

/**
 * `> [!warning] 제목` 으로 시작하는 인용문을 콜아웃 상자로 바꾼다.
 * 인용문 파싱은 markdown-it에 맡기고, 첫 줄만 떼어 내 제목으로 쓴다.
 */
export function calloutPlugin(md: MD): void {
  md.core.ruler.after('inline', 'callout', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') continue
      const para = tokens[i + 1]
      const inline = tokens[i + 2]
      if (para?.type !== 'paragraph_open' || inline?.type !== 'inline') continue
      const firstLine = inline.content.split('\n', 1)[0]
      const m = CALLOUT_HEAD_RE.exec(firstLine)
      if (!m) continue
      const close = findClose(tokens, i)
      if (close === -1) continue

      const known = findCalloutType(m[1])
      const type = known ?? CALLOUT_TYPES[0]
      const title = m[3].trim()
      const meta: CalloutMeta = {
        type: known ? known.type : m[1].toLowerCase(),
        color: type.color,
        titleHtml: title ? md.renderInline(title) : md.utils.escapeHtml(known ? known.title : m[1]),
        iconHtml: calloutIconSvg(type),
        fold: m[2] as CalloutMeta['fold']
      }
      tokens[i].meta = { callout: meta }
      tokens[close].meta = { callout: meta }

      // 첫 줄(머리)을 본문에서 뗀다. 머리만 있던 문단이면 문단째 지운다.
      const children = inline.children ?? []
      const brk = children.findIndex((c) => c.type === 'softbreak' || c.type === 'hardbreak')
      if (brk === -1) {
        tokens.splice(i + 1, 3)
      } else {
        inline.children = children.slice(brk + 1)
        inline.content = inline.content.slice(inline.content.indexOf('\n') + 1)
      }
    }
    return true
  })

  const defaultOpen =
    md.renderer.rules.blockquote_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
  const defaultClose =
    md.renderer.rules.blockquote_close ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

  md.renderer.rules.blockquote_open = (tokens, idx, options, env, self) => {
    const c = tokens[idx].meta?.callout as CalloutMeta | undefined
    if (!c) return defaultOpen(tokens, idx, options, env, self)
    const attrs = `class="callout" data-callout="${md.utils.escapeHtml(c.type)}" data-color="${c.color}"`
    const head = `${c.iconHtml}<span class="callout-title-text">${c.titleHtml}</span>`
    if (c.fold) {
      return `<details ${attrs}${c.fold === '+' ? ' open' : ''}><summary class="callout-title">${head}</summary><div class="callout-content">\n`
    }
    return `<div ${attrs}><div class="callout-title">${head}</div><div class="callout-content">\n`
  }

  md.renderer.rules.blockquote_close = (tokens, idx, options, env, self) => {
    const c = tokens[idx].meta?.callout as CalloutMeta | undefined
    if (!c) return defaultClose(tokens, idx, options, env, self)
    return c.fold ? '</div></details>\n' : '</div></div>\n'
  }
}
