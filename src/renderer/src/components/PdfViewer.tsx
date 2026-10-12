import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { snoteUrl } from '../utils/snoteUrl'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const GAP = 12
const PAD = 24
const MIN_SCALE = 0.25
const MAX_SCALE = 5
const MAX_FIT_SCALE = 1.5

interface PageSize {
  w: number
  h: number
}

// 앱을 끄기 전까지만 파일별 배율·스크롤 위치를 기억
const pdfMemory = new Map<string, { scale: number; top: number }>()

function PdfPage({
  doc,
  index,
  size,
  scale,
  root
}: {
  doc: PDFDocumentProxy
  index: number
  size: PageSize
  scale: number
  root: HTMLDivElement | null
}): React.JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    if (!box || !root) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root,
      rootMargin: '800px 0px'
    })
    io.observe(box)
    return () => io.disconnect()
  }, [root])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!visible) {
      canvas.width = 0
      canvas.height = 0
      return
    }
    let cancelled = false
    let task: RenderTask | null = null
    const timer = setTimeout(async () => {
      try {
        const page = await doc.getPage(index + 1)
        if (cancelled) return
        const dpr = window.devicePixelRatio || 1
        const viewport = page.getViewport({ scale: scale * dpr })
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        task = page.render({ canvas, viewport })
        await task.promise
      } catch (e) {
        if ((e as Error)?.name !== 'RenderingCancelledException') {
          console.error('[pdf-page]', index, e)
        }
      }
    }, 80)
    return () => {
      cancelled = true
      clearTimeout(timer)
      task?.cancel()
    }
  }, [visible, doc, index, scale])

  return (
    <div
      ref={boxRef}
      className="shrink-0 bg-white shadow-sm"
      style={{ width: size.w * scale, height: size.h * scale }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}

export function PdfViewer({ filePath }: { filePath: string }): React.JSX.Element {
  const [root, setRoot] = useState<HTMLDivElement | null>(null)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [sizes, setSizes] = useState<PageSize[] | null>(null)
  const [scale, setScale] = useState<number | null>(null)
  const [current, setCurrent] = useState(1)
  const [failed, setFailed] = useState(false)
  const prevScale = useRef<number | null>(null)
  const restoreTop = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    let task: ReturnType<typeof pdfjs.getDocument> | null = null
    void (async (): Promise<void> => {
      try {
        const res = await fetch(snoteUrl(filePath))
        if (!res.ok) throw new Error(`fetch ${res.status}`)
        const data = new Uint8Array(await res.arrayBuffer())
        if (cancelled) return
        task = pdfjs.getDocument({ data })
        const pdf = await task.promise
        if (cancelled) return
        const list = await Promise.all(
          Array.from({ length: pdf.numPages }, (_, i) =>
            pdf.getPage(i + 1).then((p) => {
              const v = p.getViewport({ scale: 1 })
              return { w: v.width, h: v.height }
            })
          )
        )
        if (cancelled) return
        setDoc(pdf)
        setSizes(list)
      } catch (e) {
        console.error('[pdf]', e)
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      void task?.destroy()
    }
  }, [filePath])

  // 처음 배율: 기억해 둔 값이 있으면 그것, 없으면 너비에 맞춤
  useLayoutEffect(() => {
    if (!root || !sizes || scale !== null) return
    const mem = pdfMemory.get(filePath)
    if (mem) {
      restoreTop.current = mem.top
      prevScale.current = mem.scale
      setScale(mem.scale)
      return
    }
    const fit = Math.max(
      MIN_SCALE,
      Math.min(MAX_FIT_SCALE, (root.clientWidth - PAD * 2) / sizes[0].w)
    )
    prevScale.current = fit
    setScale(fit)
  }, [root, sizes, scale, filePath])

  // 배율이 바뀌면 스크롤 위치를 비율로 맞춤
  useLayoutEffect(() => {
    if (!root || scale === null) return
    if (restoreTop.current !== null) {
      root.scrollTop = restoreTop.current
      restoreTop.current = null
    } else if (prevScale.current && prevScale.current !== scale) {
      const k = scale / prevScale.current
      root.scrollTop *= k
      root.scrollLeft *= k
    }
    prevScale.current = scale
    pdfMemory.set(filePath, { scale, top: root.scrollTop })
  }, [root, scale, filePath])

  useEffect(() => {
    if (!root) return
    const onWheel = (e: WheelEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      setScale((s) => (s === null ? s : Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor))))
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [root])

  const offsets = useMemo(() => {
    if (!sizes || scale === null) return []
    let y = PAD
    return sizes.map((s) => {
      const top = y
      y += s.h * scale + GAP
      return top
    })
  }, [sizes, scale])

  const handleScroll = useCallback((): void => {
    if (!root || scale === null || offsets.length === 0) return
    pdfMemory.set(filePath, { scale, top: root.scrollTop })
    const mid = root.scrollTop + root.clientHeight / 2
    let lo = 0
    let hi = offsets.length - 1
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1
      if (offsets[m] <= mid) lo = m
      else hi = m - 1
    }
    setCurrent(lo + 1)
  }, [root, scale, offsets, filePath])

  const fitWidth = (): void => {
    if (!root || !sizes) return
    setScale(
      Math.max(MIN_SCALE, Math.min(MAX_FIT_SCALE, (root.clientWidth - PAD * 2) / sizes[0].w))
    )
  }

  if (failed) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-text-tertiary">
        PDF를 열 수 없어요
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={setRoot}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto bg-bg-soft"
      >
        {doc && sizes && scale !== null && (
          <div
            className="mx-auto flex w-max min-w-full flex-col items-center"
            style={{ gap: GAP, padding: PAD }}
          >
            {sizes.map((size, i) => (
              <PdfPage key={i} doc={doc} index={i} size={size} scale={scale} root={root} />
            ))}
          </div>
        )}
      </div>
      {doc && scale !== null && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-bg-soft/90 px-2.5 py-1 text-[11px] tabular-nums text-text-secondary">
          <span>
            {current} / {doc.numPages}
          </span>
          <button
            type="button"
            onClick={fitWidth}
            title="너비에 맞춤"
            className="hover:text-text"
          >
            {Math.round(scale * 100)}%
          </button>
        </div>
      )}
    </div>
  )
}