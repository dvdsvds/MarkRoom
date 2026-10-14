import { useEffect, useRef, type RefObject } from 'react'

export function useClickHandlers(
  containerRef: RefObject<HTMLDivElement | null>,
  onWikilinkClick: ((title: string) => void) | undefined,
  onToggleTask: ((line: number) => void) | undefined,
  onLinkClick?: (href: string) => void
): void {
  const wikilinkRef = useRef(onWikilinkClick)
  const toggleTaskRef = useRef(onToggleTask)
  const linkRef = useRef(onLinkClick)
  useEffect(() => {
    wikilinkRef.current = onWikilinkClick
    toggleTaskRef.current = onToggleTask
    linkRef.current = onLinkClick
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleClick = (e: MouseEvent): void => {
      const t = e.target as HTMLElement | null
      const wiki = t?.closest('[data-wikilink]')
      if (wiki) {
        const title = wiki.getAttribute('data-wikilink')
        if (title) wikilinkRef.current?.(title)
        return
      }
      const a = t?.closest('a[href]')
      if (!a) return
      const href = a.getAttribute('href') ?? ''
      if (href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return
      e.preventDefault()
      linkRef.current?.(href)
    }
    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [containerRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleClick = (e: MouseEvent): void => {
      const input = (e.target as HTMLElement | null)?.closest('input.task-list-item-checkbox')
      if (!input) return
      const li = input.closest('li[data-line]')
      const line = li ? Number(li.getAttribute('data-line')) : NaN
      if (Number.isNaN(line)) return
      toggleTaskRef.current?.(line)
    }
    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [containerRef])
}