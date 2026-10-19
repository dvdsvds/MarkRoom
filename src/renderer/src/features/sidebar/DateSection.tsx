import { useMemo, useState } from 'react'
import type { TreeNode } from '../../types/workspace'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { useNotePropsStore } from '../../stores/notePropsStore'
import { flattenFilePaths } from '../../utils/noteIndex'
import { fileNameOf, splitName } from '../../utils/path'
import { formatDate, parseDate } from '../../utils/dateFormat'
import { isMarkdownPath } from '../../utils/fileKind'

const DAY = 'YYYY-MM-DD'

const ROW =
  'flex h-7 w-full items-center gap-2 rounded-md pl-2 pr-2 text-left text-[13px] text-text transition-colors hover:bg-bg-mute/60 focus:outline-none'

const NAV_BTN =
  'flex h-6 w-6 items-center justify-center rounded-md text-[11px] text-text-tertiary outline-none transition-colors hover:bg-bg-mute hover:text-text disabled:opacity-30 disabled:hover:bg-transparent'

/**
 * 고른 날짜에 만든 노트를 모아 보여 준다. 생성 날짜는 앱이 기록해 둔 값(created)을 쓴다.
 * ◀ ▶ 는 노트가 있는 날짜로만 옮겨 간다.
 */
export function DateSection({
  tree,
  activeFilePath,
  focusDate,
  onOpenFile
}: {
  tree: TreeNode[]
  activeFilePath: string | null
  /** 데일리 노트를 열면 그 날짜로 맞춘다 */
  focusDate: Date | null
  onOpenFile: (filePath: string) => void
}): React.JSX.Element {
  const byPath = useNotePropsStore((s) => s.byPath)
  const today = formatDate(new Date(), DAY)
  const [day, setDay] = useState(today)

  // 데일리 노트를 열 때마다 그 날짜로 맞춘다(렌더 중에 바뀐 값을 보고 한 번만 옮긴다)
  const focusDay = focusDate ? formatDate(focusDate, DAY) : null
  const [lastFocus, setLastFocus] = useState(focusDay)
  if (focusDay !== lastFocus) {
    setLastFocus(focusDay)
    if (focusDay) setDay(focusDay)
  }

  const { notesOfDay, days } = useMemo(() => {
    const byDay = new Map<string, string[]>()
    for (const path of flattenFilePaths(tree)) {
      if (!isMarkdownPath(path)) continue
      const created = byPath[path]?.created
      if (typeof created !== 'string' || !created) continue
      const list = byDay.get(created) ?? []
      list.push(path)
      byDay.set(created, list)
    }
    const sorted = (byDay.get(day) ?? []).sort((a, b) =>
      fileNameOf(a).localeCompare(fileNameOf(b), 'ko')
    )
    return { notesOfDay: sorted, days: [...byDay.keys()].sort() }
  }, [tree, byPath, day])

  const prevDay = [...days].reverse().find((d) => d < day) ?? null
  const nextDay = days.find((d) => d > day) ?? null
  const shown = parseDate(day, DAY)

  return (
    <div className="flex flex-col" onKeyDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 px-3 pb-1">
        <button
          type="button"
          disabled={!prevDay}
          onClick={() => prevDay && setDay(prevDay)}
          title={prevDay ? `이전: ${prevDay}` : '이전 날짜 없음'}
          className={NAV_BTN}
        >
          ◀
        </button>
        <span className="min-w-0 flex-1 text-center text-[12px] text-text-secondary">
          {shown ? formatDate(shown, 'YYYY-MM-DD (ddd)') : day}
        </span>
        <button
          type="button"
          disabled={!nextDay}
          onClick={() => nextDay && setDay(nextDay)}
          title={nextDay ? `다음: ${nextDay}` : '다음 날짜 없음'}
          className={NAV_BTN}
        >
          ▶
        </button>
        <button
          type="button"
          disabled={day === today}
          onClick={() => setDay(today)}
          className={`${NAV_BTN} w-auto px-1.5`}
        >
          오늘
        </button>
      </div>
      {notesOfDay.length === 0 ? (
        <p className="px-4 py-1.5 text-[12px] text-text-tertiary">이날 만든 노트가 없어요</p>
      ) : (
        <div className="px-2">
          {notesOfDay.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => onOpenFile(path)}
              title={path}
              className={`${ROW} ${path === activeFilePath ? 'bg-bg-mute' : ''}`}
            >
              <FileTypeIcon name={fileNameOf(path)} kind="file" />
              <span className="truncate">{splitName(fileNameOf(path)).base}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
