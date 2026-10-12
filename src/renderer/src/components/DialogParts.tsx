import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
  width?: number
  onClose?: () => void
  children: React.ReactNode
}

/** 화면 가운데에 뜨는 팝업 틀. body에 직접 그려서 툴바나 패널보다 항상 위에 보인다. */
export function Dialog({ width = 380, onClose, children }: DialogProps): React.JSX.Element {
  useEffect(() => {
    if (!onClose) return
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return createPortal(
    <div
      className="dlg-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-black/55"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width }}
        className="dlg-card max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-2xl"
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

interface DialogHeaderProps {
  icon: React.ReactNode
  title: React.ReactNode
  subtitle?: string
  danger?: boolean
}

export function DialogHeader({
  icon,
  title,
  subtitle,
  danger
}: DialogHeaderProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-5 pt-[18px]">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${
          danger ? 'bg-danger/15 text-danger' : 'bg-accent/15 text-accent'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-text">{title}</h2>
        {subtitle && <p className="mt-px truncate text-xs text-text-tertiary">{subtitle}</p>}
      </div>
    </div>
  )
}

export function DialogBody({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="px-5 pb-5 pt-4">{children}</div>
}

/** 아래 띠. 버튼은 같은 너비로 나란히 놓는다. */
export function DialogFooter({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex gap-2 border-t border-border bg-bg px-5 py-3.5">{children}</div>
}

const BTN = 'h-[34px] flex-1 rounded-[9px] text-[13px] font-medium focus:outline-none'

export function CancelButton({
  onClick,
  children = '취소'
}: {
  onClick: () => void
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${BTN} bg-bg-mute text-text-secondary hover:text-text`}
    >
      {children}
    </button>
  )
}

export function MainButton({
  onClick,
  disabled,
  danger,
  children
}: {
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${BTN} text-text-inverted transition-opacity hover:opacity-90 disabled:opacity-40 ${
        danger ? 'bg-danger' : 'bg-accent'
      }`}
    >
      {children}
    </button>
  )
}

/** 파일이나 폴더 이름을 눈에 띄게 보여주는 박스. */
export function NameBox({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex h-[42px] items-center gap-2.5 rounded-[10px] bg-bg px-3 shadow-[inset_0_0_0_1px_var(--color-border-strong)]">
      {children}
    </div>
  )
}

/** 안에 목록이 들어가는 박스. */
export function ListBox({ items }: { items: string[] }): React.JSX.Element {
  return (
    <ul className="mt-3 max-h-32 overflow-auto rounded-[10px] bg-bg-mute p-2.5 text-xs text-text-secondary">
      {items.map((item, i) => (
        <li key={i} className="truncate" title={item}>
          {item}
        </li>
      ))}
    </ul>
  )
}