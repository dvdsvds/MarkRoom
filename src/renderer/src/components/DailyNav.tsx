import { useMemo } from 'react'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useSettingsStore } from '../stores/settingsStore'
import { formatDate } from '../utils/dateFormat'
import { listDailyNotes } from '../utils/dailyNote'

const BTN =
  'flex h-6 items-center rounded-md px-1.5 text-[12px] text-text-secondary outline-none transition-colors hover:bg-bg-mute hover:text-text disabled:opacity-30 disabled:hover:bg-transparent'

/** 데일리 노트를 열었을 때 이전·다음 데일리 노트와 오늘로 옮겨 가는 버튼 */
export function DailyNav({
  date,
  onOpenFile,
  onOpenToday
}: {
  date: Date
  onOpenFile: (path: string) => void
  onOpenToday: () => void
}): React.JSX.Element {
  const tree = useWorkspaceStore((s) => s.tree)
  const dailyFolder = useSettingsStore((s) => s.dailyFolder)
  const dailyFormat = useSettingsStore((s) => s.dailyFormat)
  const { prev, next } = useMemo(() => {
    const notes = listDailyNotes()
    const t = date.getTime()
    return {
      prev: [...notes].reverse().find((n) => n.date.getTime() < t) ?? null,
      next: notes.find((n) => n.date.getTime() > t) ?? null
    }
    // tree·설정이 바뀌면 목록을 다시 계산한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tree, dailyFolder, dailyFormat])
  const isToday = formatDate(date, 'YYYY-MM-DD') === formatDate(new Date(), 'YYYY-MM-DD')

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        disabled={!prev}
        onClick={() => prev && onOpenFile(prev.path)}
        title={
          prev
            ? `이전 데일리 노트 (${formatDate(prev.date, dailyFormat)})`
            : '이전 데일리 노트 없음'
        }
        className={BTN}
      >
        ◀
      </button>
      <button type="button" disabled={isToday} onClick={onOpenToday} className={BTN}>
        오늘
      </button>
      <button
        type="button"
        disabled={!next}
        onClick={() => next && onOpenFile(next.path)}
        title={
          next
            ? `다음 데일리 노트 (${formatDate(next.date, dailyFormat)})`
            : '다음 데일리 노트 없음'
        }
        className={BTN}
      >
        ▶
      </button>
    </div>
  )
}
