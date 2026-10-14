import { useEffect, type RefObject } from 'react'
import copyIcon from '../../icons/tb-copy.svg?raw'
import checkIcon from '../../icons/tb-check.svg?raw'

export function useCodeDecorations(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string
): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    for (const node of Array.from(
      el.querySelectorAll<HTMLElement>(
        'span.snote-color[data-fg^="#"], span.snote-color[data-bg^="#"]'
      )
    )) {
      const fg = node.dataset.fg
      const bg = node.dataset.bg
      if (fg?.startsWith('#')) node.style.setProperty('--snote-fg', fg)
      if (bg?.startsWith('#')) node.style.setProperty('--snote-bg', bg)
    }
  }, [containerRef, html])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const timers: number[] = []
    for (const code of Array.from(el.querySelectorAll<HTMLElement>('pre > code'))) {
      const pre = code.parentElement
      if (!pre || pre.querySelector(':scope > .pre-copy')) continue
      const lang = /\blanguage-([\w+#-]+)/.exec(code.className)?.[1]
      if (lang && lang !== 'mermaid') pre.dataset.lang = lang
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'pre-copy'
      btn.title = '복사'
      btn.innerHTML = copyIcon.trim()
      btn.addEventListener('click', () => {
        void navigator.clipboard.writeText(code.textContent ?? '').then(() => {
          btn.classList.add('done')
          btn.innerHTML = checkIcon.trim()
          timers.push(
            window.setTimeout(() => {
              btn.classList.remove('done')
              btn.innerHTML = copyIcon.trim()
            }, 1200)
          )
        })
      })
      pre.prepend(btn)
    }
    return () => {
      for (const t of timers) window.clearTimeout(t)
    }
  }, [containerRef, html])
}