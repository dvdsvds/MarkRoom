export function trackMouseDrag(
  onMove: (ev: MouseEvent) => void,
  onEnd?: (ev: MouseEvent) => void
): void {
  const handleUp = (ev: MouseEvent): void => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', handleUp)
    onEnd?.(ev)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', handleUp)
}