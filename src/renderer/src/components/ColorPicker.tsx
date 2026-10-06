import { useRef, useState } from 'react'

type Hsv = { h: number; s: number; v: number }

const clamp = (n: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, n))

function hsvToRgb({ h, s, v }: Hsv): [number, number, number] {
  const c = v * s
  const hp = (h % 360) / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) [r, g, b] = [c, x, 0]
  else if (hp < 2) [r, g, b] = [x, c, 0]
  else if (hp < 3) [r, g, b] = [0, c, x]
  else if (hp < 4) [r, g, b] = [0, x, c]
  else if (hp < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const m = v - c
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function rgbToHsv([R, G, B]: [number, number, number]): Hsv {
  const r = R / 255
  const g = G / 255
  const b = B / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  if (h < 0) h += 360
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

const toHex = (hsv: Hsv): string =>
  '#' +
  hsvToRgb(hsv)
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')

function parseHex(text: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

interface ColorPickerProps {
  initialHex: string
  onChange: (hex: string) => void
}

export function ColorPicker({ initialHex, onChange }: ColorPickerProps): React.JSX.Element {
  const [hsv, setHsv] = useState<Hsv>(() => {
    const rgb = parseHex(initialHex)
    return rgb ? rgbToHsv(rgb) : { h: 32, s: 1, v: 1 }
  })
  const [hexText, setHexText] = useState(initialHex)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)

  const hexValid = parseHex(hexText) !== null

  const setFromHsv = (next: Hsv): void => {
    const hex = toHex(next)
    setHsv(next)
    setHexText(hex)
    onChange(hex)
  }

  const pickSv = (e: React.PointerEvent): void => {
    const el = svRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setFromHsv({
      h: hsv.h,
      s: clamp((e.clientX - r.left) / r.width),
      v: 1 - clamp((e.clientY - r.top) / r.height)
    })
  }

  const pickHue = (e: React.PointerEvent): void => {
    const el = hueRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setFromHsv({ h: clamp((e.clientX - r.left) / r.width) * 360, s: hsv.s, v: hsv.v })
  }

  const onHexChange = (value: string): void => {
    setHexText(value)
    const rgb = parseHex(value)
    if (!rgb) return
    const n = rgbToHsv(rgb)
    setHsv((prev) => ({ h: n.s === 0 || n.v === 0 ? prev.h : n.h, s: n.s, v: n.v }))
    onChange(toHex(n))
  }

  const marker: React.CSSProperties = {
    position: 'absolute',
    width: 12,
    height: 12,
    transform: 'translate(-50%, -50%)',
    border: '2px solid #fff',
    borderRadius: '50%',
    boxShadow: '0 0 0 1px rgba(0,0,0,.5)',
    pointerEvents: 'none'
  }

  return (
    <div
      className="flex w-[260px] select-none flex-col gap-3 rounded-lg border border-border-strong bg-bg-elevated p-3 shadow-xl"
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault()
      }}
    >
      <div
        ref={svRef}
        className="relative h-36 w-full shrink-0 cursor-crosshair rounded-md"
        style={{
          background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pickSv(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) pickSv(e)
        }}
      >
        <div style={{ ...marker, left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>

      <div
        ref={hueRef}
        className="relative h-3 w-full shrink-0 cursor-pointer rounded-full"
        style={{
          background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pickHue(e)
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) pickHue(e)
        }}
      >
        <div style={{ ...marker, left: `${(hsv.h / 360) * 100}%`, top: '50%' }} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="h-8 w-8 shrink-0 rounded-md border border-border-strong"
          style={{ background: toHex(hsv) }}
        />
        <input
          value={hexText}
          onChange={(e) => onHexChange(e.target.value)}
          spellCheck={false}
          className={`h-8 min-w-0 flex-1 select-text rounded-md border bg-bg px-2 text-sm text-text outline-none ${
            hexValid ? 'border-border focus:border-accent' : 'border-danger'
          }`}
          style={{ fontFamily: 'var(--font-editor)' }}
        />
      </div>
    </div>
  )
}