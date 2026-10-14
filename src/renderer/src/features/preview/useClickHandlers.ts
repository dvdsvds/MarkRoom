import { useEffect, useRef, type RefObject } from 'react'

export function useClickHandlers(
  containerRef: RefObject<HTMLDivElement | null>,
  onWikilinkClick: ((title: string) => void) | undefined,
  onToggleTask: ((line: number) => void) | undefined
): void {
  const wikilinkRef = useRef(onWikilinkClick)
  const toggleTaskRef = useRef(onToggleTask)
  useEffect(() => {
    wikilinkRef.current = onWikilinkClick
    toggleTaskRef.current = onToggleTask
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleClick = (e: MouseEvent): void => {
      const target = (e.target as HTMLElement | null)?.closest('[data-wikilink]')
      if (!target) return
      const title = target.getAttribute('data-wikilink')
      if (title) wikilinkRef.current?.(title)
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