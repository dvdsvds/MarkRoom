import { useEffect, useRef, type RefObject } from 'react'

export function useImageMinWidth(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string,
  onMinWidthChange: ((px: number) => void) | undefined
): void {
  const callbackRef = useRef(onMinWidthChange)
  useEffect(() => {
    callbackRef.current = onMinWidthChange
  }, [onMinWidthChange])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const EXTRA = 54
    const imgs = Array.from(el.querySelectorAll<HTMLImageElement>('img')).filter(
      (img) => !img.closest('.snote-page')
    )
    const measure = (): void => {
      const w = imgs.reduce((m, img) => Math.max(m, img.naturalWidth), 0)
      callbackRef.current?.(w > 0 ? Math.ceil(w) + EXTRA : 0)
    }
    measure()
    for (const img of imgs) if (!img.complete) img.addEventListener('load', measure)
    return () => {
      for (const img of imgs) img.removeEventListener('load', measure)
    }
  }, [containerRef, html])
}