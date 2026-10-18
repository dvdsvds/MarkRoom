import { useCallback, useState } from 'react'
import { trackMouseDrag } from '../utils/trackMouseDrag'

const MIN_WIDTH = 180
const MAX_WIDTH = 480

export function useSidebarResize(initialWidth = 224): {
  width: number
  resizing: boolean
  onResizeStart: (e: React.MouseEvent) => void
} {
  const [width, setWidth] = useState(initialWidth)
  const [resizing, setResizing] = useState(false)

  const onResizeStart = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    setResizing(true)
    trackMouseDrag(
      (ev) => setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX))),
      () => setResizing(false)
    )
  }, [])

  return { width, resizing, onResizeStart }
}