import { useEffect, useImperativeHandle, useRef, type ForwardedRef, type RefObject } from 'react'
import type { MarkdownPreviewHandle } from './MarkdownPreview'

export function useScrollSync(
  containerRef: RefObject<HTMLDivElement | null>,
  ref: ForwardedRef<MarkdownPreviewHandle>,
  onScrollRatio: ((ratio: number) => void) | undefined
): void {
  const onScrollRatioRef = useRef(onScrollRatio)
  useEffect(() => {
    onScrollRatioRef.current = onScrollRatio
  })

  useImperativeHandle(ref, () => ({
    scrollToRatio: (ratio: number) => {
      const el = containerRef.current
      if (!el) return
      const max = el.scrollHeight - el.clientHeight
      el.scrollTop = max > 0 ? ratio * max : 0
    },
    scrollToLine: (line: number) => {
      const el = containerRef.current
      const target = el?.querySelector<HTMLElement>(`[data-line="${line - 1}"]`)
      if (!el || !target) return
      const offset = target.getBoundingClientRect().top - el.getBoundingClientRect().top
      el.scrollTop += offset - 12
    }
  }))

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleScroll = (): void => {
      const max = el.scrollHeight - el.clientHeight
      onScrollRatioRef.current?.(max > 0 ? el.scrollTop / max : 0)
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [containerRef])
}