export interface MarkdownRenderer {
  render(source: string, baseDir?: string): string
}

import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import footnote from 'markdown-it-footnote'
import DOMPurify, { type Config as SanitizeConfig } from 'dompurify'
import { wikilinkPlugin } from './wikilinkPlugin'
import { blockPlugin } from './blockPlugin'
import { colorSpanPlugin } from './colorSpanPlugin'
import { templatePlugin } from './templatePlugin'

function createMarkdownIt(): InstanceType<typeof MarkdownIt> {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    breaks: false,
    typographer: false
  })

  md.block.ruler.disable('lheading')
  md.use(taskLists, { enabled: true, label: true })
  md.core.ruler.after('github-task-lists', 'task-list-line', (state) => {
    for (const token of state.tokens) {
      if (
        token.type === 'list_item_open' &&
        token.map &&
        String(token.attrGet('class') ?? '').includes('task-list-item')
      ) {
        token.attrSet('data-line', String(token.map[0]))
      }
    }
    return true
  })
  md.use(footnote)
  md.use(wikilinkPlugin)
  md.use(blockPlugin)
  md.use(templatePlugin)
  md.use(colorSpanPlugin)
  md.core.ruler.push('fence-lines', (state) => {
    for (const token of state.tokens) {
      if (token.type === 'fence' && token.level === 0 && token.map) {
        token.attrSet('data-line', String(token.map[0]))
        token.attrSet('data-end', String(token.map[1]))
      }
    }
    return true
  })
  return md
}

const md = createMarkdownIt()

const sanitizeConfig: SanitizeConfig = {
  ADD_TAGS: ['input'],
  ADD_ATTR: ['type', 'checked', 'disabled', 'id', 'class', 'data-wikilink',' data-line']
}

function resolveAttachmentSrcs(html: string, baseDir: string): string {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (match, prefix, src, suffix) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/')) return match
    return `${prefix}snote://${encodeURI(`${baseDir}/${src}`)}${suffix}`
  })
}

function markdownItRenderer(): MarkdownRenderer {
  return {
    render(source: string, baseDir?: string): string {
      const rawHtml = md.render(source)
      const clean = DOMPurify.sanitize(rawHtml, sanitizeConfig)
      return baseDir ? resolveAttachmentSrcs(clean, baseDir) : clean
    }
  }
}

export const markdownRenderer: MarkdownRenderer = markdownItRenderer()
