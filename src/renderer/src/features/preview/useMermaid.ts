import { useEffect, type RefObject } from 'react'

export function useMermaid(containerRef: RefObject<HTMLDivElement | null>, html: string): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const blocks = Array.from(el.querySelectorAll<HTMLElement>('pre > code.language-mermaid'))
    if (blocks.length === 0) return
    let cancelled = false
    void (async () => {
      const { default: mermaid } = await import('mermaid')
      if (cancelled) return
      const css = getComputedStyle(document.documentElement)
      const v = (name: string): string => css.getPropertyValue(name).trim()
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        look: 'classic',
        theme: 'base',
        fontFamily: 'Pretendard, sans-serif',
        themeVariables: {
          fontSize: '13px',
          background: v('--color-bg'),
          textColor: v('--color-text'),
          primaryColor: v('--color-bg-soft'),
          primaryTextColor: v('--color-text'),
          primaryBorderColor: v('--color-text-tertiary'),
          secondaryColor: v('--color-bg-soft'),
          tertiaryColor: v('--color-bg'),
          lineColor: v('--color-text-tertiary'),
          edgeLabelBackground: v('--color-bg')
        }
      })
      for (const [i, code] of blocks.entries()) {
        const pre = code.parentElement
        if (!pre) continue
        const id = `mermaid-${Date.now()}-${i}`
        try {
          const { svg } = await mermaid.render(id, code.textContent ?? '')
          if (cancelled) return
          const wrap = document.createElement('div')
          wrap.className = 'mermaid-diagram'
          wrap.innerHTML = svg
          pre.replaceWith(wrap)
        } catch {
          document.getElementById(`d${id}`)?.remove()
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [containerRef, html])
}