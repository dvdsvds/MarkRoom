import { useSettingsStore } from '../../stores/settingsStore'
import { formatDate } from '../../utils/dateFormat'
import { INPUT } from './SettingsParts'

function Field({
  label,
  hint,
  value,
  onChange
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-3.5 py-2 text-[13.5px] text-text">
      <div className="min-w-0">
        <div>{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-text-tertiary">{hint}</div>}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} w-48 shrink-0 text-[12.5px]`}
      />
    </div>
  )
}

export function DailyNoteSetting(): React.JSX.Element {
  const folder = useSettingsStore((s) => s.dailyFolder)
  const format = useSettingsStore((s) => s.dailyFormat)
  const setDailyNote = useSettingsStore((s) => s.setDailyNote)

  return (
    <div className="divide-y divide-border">
      <Field
        label="저장 폴더"
        hint="작업 폴더 기준. 없으면 처음 만들 때 생겨요"
        value={folder}
        onChange={(v) => setDailyNote({ folder: v.trim() })}
      />
      <Field
        label="파일 이름 형식"
        hint={`오늘: ${formatDate(new Date(), format || 'YYYY-MM-DD')}.md · YYYY MM DD M D ddd dddd`}
        value={format}
        onChange={(v) => setDailyNote({ format: v })}
      />
      <div className="px-3.5 py-2.5 text-[12px] text-text-tertiary">
        새 데일리 노트의 내용은 사이드바 템플릿의 &apos;데일리&apos;로 정해요
      </div>
    </div>
  )
}
