import { useCallback, useState } from 'react'
import { trackMouseDrag } from '../utils/trackMouseDrag'

const MIN_WIDTH = 180
const MAX_WIDTH = 480

export function useSidebarResize(initialWidth = 224): {
  width: number
  onResizeStart: (e: React.MouseEvent) => void
} {
  const [width, setWidth] = useState(initialWidth)

  const onResizeStart = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    trackMouseDrag((ev) => setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX))))
  }, [])

  return { width, onResizeStart }
}