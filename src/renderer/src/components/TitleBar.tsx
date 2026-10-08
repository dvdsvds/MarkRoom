import { useEffect, useState } from 'react'
import WindowCloseIcon from '../icons/window-close.svg?react'
import WindowMaximizeIcon from '../icons/window-maximize.svg?react'
import WindowMinimizeIcon from '../icons/window-minimize.svg?react'
import WindowRestoreIcon from '../icons/window-restore.svg?react'

interface TitleBarProps {
  children?: React.ReactNode
}

function WindowControls(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then(setIsMaximized)
    return window.api.window.onMaximizedChanged(setIsMaximized)
  }, [])

  return (
    <div className="titlebar-no-drag flex h-11 items-center">
      <button
        type="button"
        onClick={() => void window.api.window.minimize()}
        title="최소화"
        className="flex h-11 w-11 items-center justify-center text-text-secondary hover:bg-bg-mute hover:text-text"
      >
        <WindowMinimizeIcon />
      </button>
      <button
        type="button"
        onClick={() => void window.api.window.toggleMaximize()}
        title={isMaximized ? '이전 크기로' : '최대화'}
        className="flex h-11 w-11 items-center justify-center text-text-secondary hover:bg-bg-mute hover:text-text"
      >
        {isMaximized ? <WindowRestoreIcon /> : <WindowMaximizeIcon />}
      </button>
      <button
        type="button"
        onClick={() => void window.api.window.close()}
        title="닫기"
        className="flex h-11 w-11 items-center justify-center text-text-secondary hover:bg-danger hover:text-white"
      >
        <WindowCloseIcon />
      </button>
    </div>
  )
}

export function TitleBar({ children }: TitleBarProps): React.JSX.Element {
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null)

  useEffect(() => {
    void window.api.window.platform().then(setPlatform)
  }, [])

  const isMac = platform === 'darwin'

  return (
    <header
      className={`titlebar-drag flex h-7 shrink-0 items-center border-b border-border bg-bg-soft ${
        isMac ? 'flex-row-reverse' : ''
      }`}
      onDoubleClick={() => void window.api.window.toggleMaximize()}
    >
      <div
        className="titlebar-no-drag flex items-center"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      <div className="flex flex-1 items-center justify-center">
        <span className="text-xs text-text-tertiary">SyntaxNote</span>
      </div>
      {platform && (
        <div onDoubleClick={(e) => e.stopPropagation()}>
          <WindowControls />
        </div>
      )}
    </header>
  )
}