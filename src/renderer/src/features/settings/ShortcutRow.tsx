import { useEffect, useState } from 'react'
import { useSettingsStore } from '../../stores/settingsStore'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_LABELS,
  eventToShortcut,
  findConflict,
  type ShortcutAction
} from '../../utils/shortcuts'

interface ShortcutRowProps {
  action: ShortcutAction
}

export function ShortcutRow({ action }: ShortcutRowProps): React.JSX.Element {
  const combo = useSettingsStore((s) => s.shortcuts[action])
  const shortcuts = useSettingsStore((s) => s.shortcuts)
  const setShortcut = useSettingsStore((s) => s.setShortcut)
  const resetShortcut = useSettingsStore((s) => s.resetShortcut)
  const [capturing, setCapturing] = useState(false)
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!capturing) return
    const handler = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setCapturing(false)
        return
      }
      const newCombo = eventToShortcut(e)
      if (!newCombo) return
      const conflictWith = findConflict(shortcuts, action, newCombo)
      if (conflictWith) {
        setConflictMessage(`이미 "${SHORTCUT_LABELS[conflictWith]}"에서 쓰고 있어요.`)
        return
      }
      setShortcut(action, newCombo)
      setCapturing(false)
      setConflictMessage(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [capturing, shortcuts, action, setShortcut])

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <span className="text-[13px] text-text">{SHORTCUT_LABELS[action]}</span>
      <div className="flex items-center gap-1">
        {conflictMessage && <span className="text-xs text-danger">{conflictMessage}</span>}
        <button
          type="button"
          onClick={() => {
            setConflictMessage(null)
            setCapturing(true)
          }}
          className={`min-w-[120px] rounded-md border bg-bg px-2.5 py-1 text-center font-mono text-[11px] focus:outline-none ${
            capturing
              ? 'border-accent text-accent'
              : 'border-border text-text-secondary hover:border-border-strong'
          }`}
        >
          {capturing ? '키를 눌러주세요…' : combo}
        </button>
        {combo !== DEFAULT_SHORTCUTS[action] && (
          <button
            type="button"
            onClick={() => resetShortcut(action)}
            title="기본값으로"
            className="rounded px-1.5 text-xs text-text-tertiary hover:text-accent"
          >
            ↺
          </button>
        )}
      </div>
    </div>
  )
}
