import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  /** 항목 왼쪽 아이콘 (svg 컴포넌트) */
  icon?: React.ReactNode
  /** true면 이 항목 위에 구분선을 그린다 */
  sepBefore?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

const EDGE = 8

/** 트리 우클릭 메뉴 (기획 문서 8장 "우클릭 메뉴"). 바깥을 클릭하거나 Esc로 닫힌다. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  // 화면 밖으로 나가면 안쪽으로 당긴다.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPos({
      left: Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE)),
      top: Math.max(EDGE, Math.min(y, window.innerHeight - height - EDGE))
    })
  }, [x, y, items.length])

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // body에 직접 그려서 에디터 툴바(.cm-panels, z-index 300)보다 항상 위에 보이게 한다.
  return createPortal(
    <div
      ref={ref}
      className="ctx-menu fixed z-[1100] w-52 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-xl"
      style={{ left: pos.left, top: pos.top }}
    >
      {items.map((item) => (
        <div key={item.label}>
          {item.sepBefore && <div className="mx-1 my-1.5 h-px bg-border" />}
          <button
            type="button"
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className={`flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] focus:outline-none ${
              item.danger ? 'text-danger hover:bg-danger/12' : 'text-text hover:bg-bg-mute'
            }`}
          >
            {item.icon && (
              <span
                className={`flex size-4 shrink-0 items-center justify-center ${
                  item.danger ? 'text-danger' : 'text-text-tertiary'
                }`}
              >
                {item.icon}
              </span>
            )}
            {item.label}
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}