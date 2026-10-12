import { useCallback, useRef, useState, type RefObject } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { trackMouseDrag } from '../utils/trackMouseDrag'

export const EDITOR_MIN_WIDTH = 396

export function useSplitResize(
  splitRef: RefObject<HTMLDivElement | null>,
  locked: boolean,
  previewMinWidth: number
): {
  ratio: number
  onResizeStart: (e: React.MouseEvent) => void
  resetRatio: () => void
} {
  const splitRatio = useSettingsStore((s) => s.splitRatio)
  const setSplitRatio = useSettingsStore((s) => s.setSplitRatio)
  const [draft, setDraft] = useState<number | null>(null)
  const previewMinWidthRef = useRef(previewMinWidth)
  previewMinWidthRef.current = previewMinWidth

  const onResizeStart = useCallback(
    (e: React.MouseEvent): void => {
      e.preventDefault()
      if (locked) return
      const box = splitRef.current
      if (!box) return
      const rect = box.getBoundingClientRect()
      let latest = useSettingsStore.getState().splitRatio
      trackMouseDrag(
        (ev) => {
          const minRatio = Math.min(0.8, Math.max(0.2, EDITOR_MIN_WIDTH / rect.width))
          const maxRatio = Math.max(
            minRatio,
            Math.min(0.8, (rect.width - previewMinWidthRef.current - 1) / rect.width)
          )
          latest = Math.min(maxRatio, Math.max(minRatio, (ev.clientX - rect.left) / rect.width))
          setDraft(latest)
        },
        () => {
          setSplitRatio(latest)
          setDraft(null)
        }
      )
    },
    [splitRef, locked, setSplitRatio]
  )

  const resetRatio = useCallback((): void => {
    if (!locked) setSplitRatio(0.5)
  }, [locked, setSplitRatio])

  return { ratio: locked ? 0.5 : (draft ?? splitRatio), onResizeStart, resetRatio }
}