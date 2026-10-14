import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { renderTemplate } from '../templateRender'
import type { ParsedTemplate } from '../../features/template/parse/templatePlugin'

export function useTemplateRender(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string,
  editIdxRef: MutableRefObject<number | null>,
  editModeRef: MutableRefObject<boolean>
): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    for (const [ti, node] of Array.from(
      el.querySelectorAll<HTMLElement>('div.snote-template')
    ).entries()) {
      let parsed: ParsedTemplate
      try {
        parsed = JSON.parse(node.dataset.spec ?? '') as ParsedTemplate
      } catch {
        parsed = { error: '양식을 읽을 수 없어요.' }
      }
      if ('error' in parsed) {
        const e = document.createElement('div')
        e.className = 'code-run-out error'
        e.textContent = parsed.error
        node.replaceChildren(e)
      } else {
        const wrap = renderTemplate(parsed)
        wrap.dataset.close = String(parsed.close)
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'tp-edit-btn'
        const on = editIdxRef.current === ti
        btn.textContent = on ? '편집 끝' : '편집'
        if (on) wrap.classList.add('tq-editmode')
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const next = editIdxRef.current === ti ? null : ti
          editIdxRef.current = next
          editModeRef.current = next !== null
          el.dispatchEvent(new Event('snote-editmode'))
          for (const w of Array.from(el.querySelectorAll<HTMLElement>('.snote-template-wrap'))) {
            w.classList.remove('tq-editmode')
            const b = w.querySelector<HTMLButtonElement>('.tp-edit-btn')
            if (b) b.textContent = '편집'
          }
          if (next !== null) {
            wrap.classList.add('tq-editmode')
            btn.textContent = '편집 끝'
          }
          for (const n of Array.from(el.querySelectorAll('.tq-selected')))
            n.classList.remove('tq-selected')
        })
        wrap.appendChild(btn)
        node.replaceChildren(wrap)
      }
    }

    const pages = Array.from(el.querySelectorAll<HTMLElement>('.snote-page'))
    el.style.maxWidth = pages.length > 0 ? 'none' : ''
    el.style.padding = pages.length > 0 ? '0' : ''
    if (pages.length === 0) return

    const PAGE_W = (210 / 25.4) * 96
    const MAX_SCALE = 2
    const MIN_SCALE = 0.1
    let raf = 0

    const fit = (): void => {
      const cs = getComputedStyle(el)
      const availW = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      for (const page of pages) {
        page.style.setProperty('zoom', '1')
        const scale = Math.min(MAX_SCALE, availW / PAGE_W)
        page.style.setProperty('zoom', String(Math.max(MIN_SCALE, scale)))
      }
    }
    const schedule = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(fit)
    }

    fit()
    const ro = new ResizeObserver(schedule)
    el.addEventListener('snote-editmode', schedule)
    ro.observe(el)
    void document.fonts.ready.then(schedule)
    el.dispatchEvent(new Event('snote-rendered'))
    return () => {
      el.style.padding = ''
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('snote-editmode', schedule)
    }
  }, [containerRef, html, editIdxRef, editModeRef])
}