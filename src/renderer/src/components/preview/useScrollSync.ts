import { useEffect, useImperativeHandle, useRef, type ForwardedRef, type RefObject } from 'react'
import type { MarkdownPreviewHandle } from '../MarkdownPreview'

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