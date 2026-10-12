import { PdfViewer } from './PdfViewer'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileKind } from '../utils/fileKind'
import { snoteUrl } from '@renderer/utils/snoteUrl'

const MIN_SCALE = 0.05
const MAX_SCALE = 20

interface View {
  s: number
  tx: number
  ty: number
}

// 앱을 끄기 전까지만 파일별 확대 상태를 기억
const viewMemory = new Map<string, View>()

function ImageViewer({ filePath }: { filePath: string }): React.JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null)
  const natural = useRef({ w: 0, h: 0 })
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const [view, setView] = useState<View | null>(() => viewMemory.get(filePath) ?? null)
  const [failed, setFailed] = useState(false)

  const fit = useCallback((): View => {
    const box = boxRef.current
    const { w, h } = natural.current
    if (!box || !w || !h) return { s: 1, tx: 0, ty: 0 }
    const s = Math.min(1, box.clientWidth / w, box.clientHeight / h)
    return { s, tx: (box.clientWidth - w * s) / 2, ty: (box.clientHeight - h * s) / 2 }
  }, [])

  useEffect(() => {
    if (view) viewMemory.set(filePath, view)
  }, [view, filePath])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey || !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const rect = box.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      setView((v) => {
        if (!v) return v
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor))
        const k = s / v.s
        return { s, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k }
      })
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [])

  if (failed) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-text-tertiary">
        이미지를 열 수 없어요
      </div>
    )
  }

  return (
    <div
      ref={boxRef}
      className="relative min-h-0 flex-1 cursor-grab select-none overflow-hidden active:cursor-grabbing"
      onPointerDown={(e) => {
        if (!view) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        setView((v) => (v ? { ...v, tx: d.tx + e.clientX - d.x, ty: d.ty + e.clientY - d.y } : v))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => setView(fit())}
    >
      <img
        src={snoteUrl(filePath)}
        alt=""
        draggable={false}
        onLoad={(e) => {
          natural.current = {
            w: e.currentTarget.naturalWidth,
            h: e.currentTarget.naturalHeight
          }
          setView((v) => v ?? fit())
        }}
        onError={() => setFailed(true)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          maxWidth: 'none',
          transformOrigin: '0 0',
          visibility: view ? 'visible' : 'hidden',
          transform: view ? `translate(${view.tx}px, ${view.ty}px) scale(${view.s})` : undefined
        }}
      />
    </div>
  )
}

export function FileViewer({
  filePath,
  kind
}: {
  filePath: string
  kind: Exclude<FileKind, 'text'>
}): React.JSX.Element {
  if (kind === 'pdf') return <PdfViewer filePath={filePath} />
  return <ImageViewer filePath={filePath} />
}