import { motion } from 'motion/react'

const MOD = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
const EMPTY_HINTS: { label: string; keys: string }[] = [
  { label: '새 파일', keys: `${MOD}+N` },
  { label: '검색', keys: `${MOD}+P` },
  { label: '할 일', keys: `${MOD}+Shift+T` },
  { label: '백링크', keys: `${MOD}+Shift+B` },
  { label: '설정', keys: `${MOD}+,` }
]

export function EmptyState(): React.JSX.Element {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center gap-7"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="text-center">
        <div className="text-[15px] font-medium tracking-tight text-text-secondary">MarkRoom</div>
      </div>
      <dl className="grid grid-cols-[auto_auto] items-center gap-x-8 gap-y-2.5 text-xs">
        {EMPTY_HINTS.map((h) => (
          <div key={h.label} className="contents">
            <dt className="text-text-tertiary">{h.label}</dt>
            <dd className="justify-self-end">
              <kbd
                className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-text-secondary"
                style={{ fontFamily: 'var(--font-editor)' }}
              >
                {h.keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
    </motion.div>
  )
}