import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import {
  ALPHA_DECAY,
  ALPHA_MIN,
  createNodes,
  tick,
  type SimLink,
  type SimNode
} from '@renderer/utils/forceLayout'

type LinkGraph = Awaited<ReturnType<typeof window.api.workspace.linkGraph>>
type Scope = 'all' | 'local'

interface GraphView {
  paths: string[]
  titles: string[]
  links: SimLink[]
  neighbors: Set<number>[]
}

interface GraphDialogProps {
  activePath: string | null
  onOpen: (filePath: string) => void
  onClose: () => void
}

const SEGMENT_WIDTH = 72
const MIN_ZOOM = 0.15
const MAX_ZOOM = 4
const CLICK_TOLERANCE = 4

function buildView(graph: LinkGraph, scope: Scope, activePath: string | null): GraphView {
  let nodes = graph.nodes
  let edges = graph.edges
  if (scope === 'local' && activePath) {
    const keep = new Set([activePath])
    for (const e of edges) {
      if (e.source === activePath) keep.add(e.target)
      if (e.target === activePath) keep.add(e.source)
    }
    nodes = nodes.filter((n) => keep.has(n.path))
    edges = edges.filter((e) => keep.has(e.source) && keep.has(e.target))
  }
  const index = new Map(nodes.map((n, i) => [n.path, i]))
  const links: SimLink[] = []
  const neighbors = nodes.map(() => new Set<number>())
  for (const e of edges) {
    const source = index.get(e.source)
    const target = index.get(e.target)
    if (source === undefined || target === undefined) continue
    links.push({ source, target })
    neighbors[source].add(target)
    neighbors[target].add(source)
  }
  return {
    paths: nodes.map((n) => n.path),
    titles: nodes.map((n) => n.title),
    links,
    neighbors
  }
}

function readColors(): Record<'text' | 'muted' | 'faint' | 'accent' | 'font', string> {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string): string => css.getPropertyValue(name).trim()
  return {
    text: v('--color-text'),
    muted: v('--color-text-secondary'),
    faint: v('--color-text-tertiary'),
    accent: v('--color-accent'),
    font: v('--font-ui') || 'sans-serif'
  }
}

export function GraphDialog({ activePath, onOpen, onClose }: GraphDialogProps): React.JSX.Element {
  const [graph, setGraph] = useState<LinkGraph | null>(null)
  const [scope, setScope] = useState<Scope>('all')
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onOpenRef = useRef(onOpen)
  useEffect(() => {
    onOpenRef.current = onOpen
  })

  useEffect(() => {
    void window.api.workspace.linkGraph().then(setGraph)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canLocal = activePath !== null && graph?.nodes.some((n) => n.path === activePath) === true
  const view = useMemo(
    () => (graph ? buildView(graph, canLocal ? scope : 'all', activePath) : null),
    [graph, scope, canLocal, activePath]
  )

  useEffect(() => {
    const box = boxRef.current
    const canvas = canvasRef.current
    if (!box || !canvas || !view || view.paths.length === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const nodes: SimNode[] = createNodes(view.paths.length)
    const degree = view.neighbors.map((s) => s.size)
    const radius = degree.map((d) => 4 + Math.min(8, Math.sqrt(d) * 2))
    const activeIndex = activePath ? view.paths.indexOf(activePath) : -1
    const cam = { x: 0, y: 0, k: 1 }
    let alpha = 1
    let hover = -1
    let width = 0
    let height = 0
    let frame = 0
    let colors = readColors()

    const warmup = Math.min(200, Math.floor(60000 / Math.max(1, view.paths.length)))
    for (let i = 0; i < warmup; i++) {
      tick(nodes, view.links, alpha)
      alpha *= ALPHA_DECAY
    }

    const fit = (): void => {
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const n of nodes) {
        minX = Math.min(minX, n.x)
        maxX = Math.max(maxX, n.x)
        minY = Math.min(minY, n.y)
        maxY = Math.max(maxY, n.y)
      }
      const w = Math.max(1, maxX - minX)
      const h = Math.max(1, maxY - minY)
      cam.k = Math.min(1.5, Math.max(MIN_ZOOM, Math.min((width - 80) / w, (height - 80) / h)))
      cam.x = -((minX + maxX) / 2) * cam.k
      cam.y = -((minY + maxY) / 2) * cam.k
    }

    const toWorld = (sx: number, sy: number): { x: number; y: number } => ({
      x: (sx - width / 2 - cam.x) / cam.k,
      y: (sy - height / 2 - cam.y) / cam.k
    })

    const hitTest = (sx: number, sy: number): number => {
      const p = toWorld(sx, sy)
      let best = -1
      let bestD = Infinity
      for (let i = 0; i < nodes.length; i++) {
        const dx = nodes[i].x - p.x
        const dy = nodes[i].y - p.y
        const d = dx * dx + dy * dy
        const r = radius[i] + 4 / cam.k
        if (d < r * r && d < bestD) {
          best = i
          bestD = d
        }
      }
      return best
    }

    const draw = (): void => {
      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(
        dpr * cam.k,
        0,
        0,
        dpr * cam.k,
        dpr * (width / 2 + cam.x),
        dpr * (height / 2 + cam.y)
      )
      const focus = hover !== -1 ? hover : -1
      const near = focus !== -1 ? view.neighbors[focus] : null
      const isLit = (i: number): boolean => focus === -1 || i === focus || near!.has(i)

      ctx.lineWidth = 1 / cam.k
      for (const link of view.links) {
        const lit = focus !== -1 && (link.source === focus || link.target === focus)
        ctx.globalAlpha = lit ? 1 : focus === -1 ? 0.45 : 0.12
        ctx.strokeStyle = lit ? colors.accent : colors.faint
        const s = nodes[link.source]
        const t = nodes[link.target]
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.stroke()
      }

      for (let i = 0; i < nodes.length; i++) {
        ctx.globalAlpha = isLit(i) ? 1 : 0.25
        ctx.fillStyle = i === activeIndex || i === focus ? colors.accent : colors.faint
        ctx.beginPath()
        ctx.arc(nodes[i].x, nodes[i].y, radius[i], 0, Math.PI * 2)
        ctx.fill()
        if (i === activeIndex) {
          ctx.lineWidth = 1.5 / cam.k
          ctx.strokeStyle = colors.accent
          ctx.beginPath()
          ctx.arc(nodes[i].x, nodes[i].y, radius[i] + 3 / cam.k, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      ctx.font = `${12 / cam.k}px ${colors.font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      for (let i = 0; i < nodes.length; i++) {
        const important = i === activeIndex || i === focus || (near?.has(i) ?? false)
        if (!important && (cam.k < 0.7 || focus !== -1)) continue
        ctx.globalAlpha = 1
        ctx.fillStyle = i === focus ? colors.text : colors.muted
        ctx.fillText(view.titles[i], nodes[i].x, nodes[i].y + radius[i] + 4 / cam.k)
      }
      ctx.globalAlpha = 1
    }

    const loop = (): void => {
      frame = 0
      if (alpha > ALPHA_MIN) {
        tick(nodes, view.links, alpha)
        alpha *= ALPHA_DECAY
      }
      draw()
      if (alpha > ALPHA_MIN) frame = requestAnimationFrame(loop)
    }
    const requestDraw = (): void => {
      if (!frame) frame = requestAnimationFrame(loop)
    }
    const reheat = (value: number): void => {
      alpha = Math.max(alpha, value)
      requestDraw()
    }

    const resize = (): void => {
      const rect = box.getBoundingClientRect()
      const first = width === 0
      width = rect.width
      height = rect.height
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      if (first) fit()
      requestDraw()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(box)

    const themeObserver = new MutationObserver(() => {
      colors = readColors()
      requestDraw()
    })
    themeObserver.observe(document.documentElement, { attributes: true })

    let drag: {
      mode: 'node' | 'pan'
      index: number
      startX: number
      startY: number
      moved: boolean
    } | null = null

    const local = (e: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const onPointerDown = (e: PointerEvent): void => {
      const p = local(e)
      const index = hitTest(p.x, p.y)
      drag = { mode: index === -1 ? 'pan' : 'node', index, startX: p.x, startY: p.y, moved: false }
      canvas.setPointerCapture(e.pointerId)
      if (index !== -1) nodes[index].fixed = true
    }

    const onPointerMove = (e: PointerEvent): void => {
      const p = local(e)
      if (!drag) {
        const index = hitTest(p.x, p.y)
        if (index !== hover) {
          hover = index
          canvas.style.cursor = index === -1 ? 'grab' : 'pointer'
          requestDraw()
        }
        return
      }
      if (Math.hypot(p.x - drag.startX, p.y - drag.startY) > CLICK_TOLERANCE) drag.moved = true
      if (drag.mode === 'pan') {
        cam.x += e.movementX
        cam.y += e.movementY
        canvas.style.cursor = 'grabbing'
        requestDraw()
      } else if (drag.moved) {
        const w = toWorld(p.x, p.y)
        nodes[drag.index].x = w.x
        nodes[drag.index].y = w.y
        reheat(0.3)
      }
    }

    const onPointerUp = (e: PointerEvent): void => {
      if (!drag) return
      const { mode, index, moved } = drag
      drag = null
      canvas.releasePointerCapture(e.pointerId)
      canvas.style.cursor = hover === -1 ? 'grab' : 'pointer'
      if (mode === 'node') {
        nodes[index].fixed = false
        if (!moved) onOpenRef.current(view.paths[index])
      }
    }

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const rect = canvas.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const before = toWorld(sx, sy)
      cam.k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cam.k * Math.exp(-e.deltaY * 0.0015)))
      cam.x = sx - width / 2 - before.x * cam.k
      cam.y = sy - height / 2 - before.y * cam.k
      requestDraw()
    }

    const onLeave = (): void => {
      if (drag || hover === -1) return
      hover = -1
      requestDraw()
    }

    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      themeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [view, activePath])

  const scopeOptions: { value: Scope; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'local', label: '현재 노트' }
  ]
  const effectiveScope = canLocal ? scope : 'all'

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      style={{ willChange: 'opacity' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        style={{ willChange: 'transform, opacity' }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
        className="flex h-[min(720px,calc(100vh-64px))] w-[min(1000px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        <div className="flex shrink-0 items-center justify-between pb-2.5 pl-[22px] pr-4 pt-4">
          <div>
            <h2 className="text-[17px] font-medium text-text">그래프</h2>
            <p className="mt-1 text-[13px] text-text-secondary">
              {view ? `노트 ${view.paths.length}개 · 연결 ${view.links.length}개` : '불러오는 중…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              className="relative inline-flex rounded-[9px] bg-text/[0.07] p-0.5"
            >
              <span
                aria-hidden="true"
                className="absolute left-0.5 top-0.5 h-6 rounded-[7px] bg-text/[0.13] transition-transform duration-150 ease-out"
                style={{
                  width: SEGMENT_WIDTH,
                  transform: `translateX(${effectiveScope === 'local' ? SEGMENT_WIDTH : 0}px)`
                }}
              />
              {scopeOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={effectiveScope === o.value}
                  disabled={o.value === 'local' && !canLocal}
                  title={o.value === 'local' && !canLocal ? '노트를 열면 쓸 수 있어요' : undefined}
                  onClick={() => setScope(o.value)}
                  className={`relative h-6 rounded-[7px] text-[12.5px] outline-none transition-colors disabled:opacity-40 ${
                    effectiveScope === o.value ? 'text-text' : 'text-text-secondary hover:text-text'
                  }`}
                  style={{ width: SEGMENT_WIDTH }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              title="닫기 (Esc)"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-mute hover:text-text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </div>
        </div>
        <div ref={boxRef} className="relative min-h-0 flex-1 border-t border-border">
          {view && view.paths.length === 0 ? (
            <p className="px-2 py-8 text-center text-[13px] text-text-tertiary">노트가 없어요.</p>
          ) : (
            <canvas ref={canvasRef} className="absolute inset-0 touch-none" />
          )}
          <p className="pointer-events-none absolute bottom-2.5 left-3.5 text-[11.5px] text-text-tertiary">
            휠: 확대/축소 · 빈 곳 드래그: 이동 · 노트 클릭: 열기
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}
