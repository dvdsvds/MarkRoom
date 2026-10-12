import { useMemo } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import type { Tab } from '../stores/tabsStore'
import { fileNameOf } from '@renderer/utils/path'

interface StatusBarProps {
  tab: Tab | null
  isViewer: boolean
  vimModeLabel: string
  cursorPos: { line: number; col: number }
}

export function StatusBar({
  tab,
  isViewer,
  vimModeLabel,
  cursorPos
}: StatusBarProps): React.JSX.Element {
  const vimMode = useSettingsStore((s) => s.vimMode)
  const uiZoom = useSettingsStore((s) => s.uiZoom)
  const setUiZoom = useSettingsStore((s) => s.setUiZoom)
  const showLineCol = useSettingsStore((s) => s.showLineCol)
  const showWordCount = useSettingsStore((s) => s.showWordCount)
  const showCharCount = useSettingsStore((s) => s.showCharCount)
  const charCountIncludeSpaces = useSettingsStore((s) => s.charCountIncludeSpaces)
  const charCountExcludeSpaces = useSettingsStore((s) => s.charCountExcludeSpaces)

  const content = tab?.content ?? ''
  const wordCount = useMemo(() => content.split(/\s+/).filter((w) => w.length > 0).length, [content])
  const charCountWithSpaces = content.length
  const charCountWithoutSpaces = useMemo(() => content.replace(/\s/g, '').length, [content])
  const filePathLabel = tab?.filePath ? fileNameOf(tab.filePath) : ''

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border px-3 text-[11px] tabular-nums text-text-tertiary">
      <div className="flex items-center gap-2">
        {vimMode && !isViewer ? (
          <span className="font-semibold text-accent">-- {vimModeLabel} --</span>
        ) : (
          <span className="truncate">{filePathLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {vimMode && !isViewer && <span className="truncate">{filePathLabel}</span>}
        {tab && !isViewer && showLineCol && (
          <span>
            {cursorPos.line}:{cursorPos.col}
          </span>
        )}
        {tab && !isViewer && showWordCount && <span>{wordCount}단어</span>}
        {tab && !isViewer && showCharCount && (charCountIncludeSpaces || charCountExcludeSpaces) && (
          <span>
            {[
              charCountIncludeSpaces ? `${charCountWithSpaces}자` : null,
              charCountExcludeSpaces ? `공백 제외 ${charCountWithoutSpaces}자` : null
            ]
              .filter(Boolean)
              .join(' / ')}
          </span>
        )}
        <button
          type="button"
          onClick={() => setUiZoom(100)}
          title="100%로 초기화"
          className="hover:text-text"
        >
          {uiZoom}%
        </button>
      </div>
    </footer>
  )
}