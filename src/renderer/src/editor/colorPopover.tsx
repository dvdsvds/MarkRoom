import { createRoot, type Root } from 'react-dom/client'
import { ColorPicker } from '../components/ColorPicker'

const WIDTH = 260
const HEIGHT = 250

let current: { root: Root; host: HTMLElement; off: () => void } | null = null

export function closeColorPopover(): void {
  if (!current) return
  const { root, host, off } = current
  current = null
  off()
  root.unmount()
  host.remove()
}

export function openColorPopover(
  anchor: HTMLElement,
  initialHex: string,
  onChange: (hex: string) => void
): void {
  closeColorPopover()

  const r = anchor.getBoundingClientRect()
  const left = Math.max(8, Math.min(r.left, window.innerWidth - WIDTH - 8))
  const below = r.bottom + 6
  const top = below + HEIGHT > window.innerHeight ? Math.max(8, r.top - HEIGHT - 6) : below

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;z-index:70;left:${left}px;top:${top}px;`
  document.body.appendChild(host)

  const onDown = (e: MouseEvent): void => {
    if (!host.contains(e.target as Node)) closeColorPopover()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return
    e.stopPropagation()
    closeColorPopover()
  }
  document.addEventListener('mousedown', onDown, true)
  document.addEventListener('keydown', onKey, true)

  const root = createRoot(host)
  root.render(<ColorPicker initialHex={initialHex} onChange={onChange} />)
  current = {
    root,
    host,
    off: () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }
}
