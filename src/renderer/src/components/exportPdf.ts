const PAGE_CSS = `
@page { size: A4; margin: 0 }
html, body { margin: 0; padding: 0; background: #fff; }
.snote-page { zoom: 1 !important; margin: 0 !important; box-shadow: none !important; break-after: page; }
.snote-page:last-child { break-after: auto; }
.snote-plain { box-sizing: border-box; width: 210mm; padding: 18mm 20mm; }
`

function collectCss(): string {
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    const base = sheet.href ?? document.baseURI
    for (const rule of Array.from(rules)) {
      out.push(
        rule.cssText.replace(
          /url\(\s*(['"]?)(?!data:|https?:|file:|snote:|#)([^'")]+)\1\s*\)/g,
          (_m, _q, u: string) => `url("${new URL(u, base).href}")`
        )
      )
    }
  }
  return out.join('\n') + PAGE_CSS
}

function clean(node: HTMLElement): void {
  for (const x of Array.from(node.querySelectorAll('.tp-edit-btn, .code-run-bar'))) x.remove()
  for (const cls of ['tq-selected', 'tq-editing', 'tq-editmode', 'tq-hot-col', 'tq-hot-row']) {
    node.classList.remove(cls)
    for (const x of Array.from(node.querySelectorAll('.' + cls))) x.classList.remove(cls)
  }
  node.style.removeProperty('zoom')
}

export async function exportPreviewPdf(
  title: string
): Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }> {
  const root = document.querySelector<HTMLElement>('.prose-preview')
  if (!root) return { ok: false, error: '미리보기를 찾을 수 없어요' }
  const pages = Array.from(root.querySelectorAll<HTMLElement>('.snote-page'))
const html =
    pages.length > 0
      ? pages
          .map((n) => {
            const c = n.cloneNode(true) as HTMLElement
            clean(c)
            return c.outerHTML
          })
          .join('\n')
      : (() => {
          const c = root.cloneNode(true) as HTMLElement
          clean(c)
          c.style.maxWidth = 'none'
          c.style.padding = '0'
          return `<div class="snote-plain">${c.outerHTML}</div>`
        })()
  return window.api.export.pdf({ title, html, css: collectCss() })
}