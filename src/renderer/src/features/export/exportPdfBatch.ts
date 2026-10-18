import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { MarkdownPreview } from '../preview/MarkdownPreview'
import { collectCss, extractHtml } from './exportPdf'

type PdfNote = Awaited<ReturnType<typeof window.api.workspace.listPdfNotes>>[number]

const BROKEN_STYLE = 'text-decoration:line-through;color:#999'
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function settle(host: HTMLElement): Promise<void> {
  await sleep(50)
  const start = Date.now()
  while (host.querySelector('pre > code.language-mermaid') && Date.now() - start < 5000) {
    await sleep(100)
  }
  await document.fonts.ready
  await sleep(50)
}

function transformLinks(host: HTMLElement, note: PdfNote): void {
  // 종이에서는 접을 수 없으니 접힌 콜아웃은 펼쳐서 낸다
  for (const d of Array.from(host.querySelectorAll('details'))) d.setAttribute('open', '')
  for (const sp of Array.from(host.querySelectorAll<HTMLElement>('span[data-wikilink]'))) {
    const title = sp.getAttribute('data-wikilink') ?? ''
    if (!title) {
      // `[[#제목]]`처럼 같은 문서를 가리키는 링크는 글자만 남긴다
      sp.removeAttribute('data-wikilink')
      continue
    }
    const href = Object.prototype.hasOwnProperty.call(note.links, title) ? note.links[title] : null
    if (href) {
      const a = document.createElement('a')
      a.className = 'wikilink'
      a.setAttribute('href', href)
      a.textContent = sp.textContent
      sp.replaceWith(a)
    } else {
      sp.removeAttribute('data-wikilink')
      sp.setAttribute('style', BROKEN_STYLE)
    }
  }
  for (const a of Array.from(host.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
    const h = a.getAttribute('href') ?? ''
    if (a.classList.contains('wikilink') || SCHEME_RE.test(h) || h.startsWith('#')) continue
    a.replaceWith(document.createTextNode(a.textContent ?? ''))
  }
}

async function renderNote(note: PdfNote, css: string, pdfDir: string): Promise<string | null> {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:900px;height:600px;overflow:auto;visibility:hidden'
  document.body.append(host)
  const root = createRoot(host)
  try {
    flushSync(() =>
      root.render(createElement(MarkdownPreview, { source: note.source, baseDir: note.baseDir }))
    )
    await settle(host)
    transformLinks(host, note)
    const preview = host.querySelector<HTMLElement>('.prose-preview')
    if (!preview) return '미리보기를 만들지 못했어요'
    const res = await window.api.export.pdfFile({
      html: extractHtml(preview),
      css,
      pdfDir,
      relPath: note.relPath
    })
    return res.ok ? null : (res.error ?? '실패')
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  } finally {
    root.unmount()
    host.remove()
  }
}

export async function exportPdfBatch(
  notes: PdfNote[],
  pdfDir: string,
  onProgress: (done: number, total: number) => void
): Promise<string[]> {
  const css = collectCss()
  const failed: string[] = []
  for (const [i, note] of notes.entries()) {
    const err = await renderNote(note, css, pdfDir)
    if (err) failed.push(`${note.relPath}: ${err}`)
    onProgress(i + 1, notes.length)
  }
  return failed
}
