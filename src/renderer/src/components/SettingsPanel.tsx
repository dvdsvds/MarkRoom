import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useSettingsStore } from '../stores/settingsStore'
import { ConfirmDialog } from './ConfirmDialog'
import { Card } from './settings/SettingsParts'
import { CATEGORIES, useSettingItems, type Category, type SettingItem } from './settings/useSettingItems'

interface SettingsPanelProps {
  onClose: () => void
}

interface Section {
  group?: string
  items: SettingItem[]
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const resetEditorFont = useSettingsStore((s) => s.resetEditorFont)
  const resetPreviewFont = useSettingsStore((s) => s.resetPreviewFont)
  const resetAllShortcuts = useSettingsStore((s) => s.resetAllShortcuts)

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('일반')
  const [viewMode, setViewMode] = useState<'search' | 'category'>('category')
  const [confirmResetShortcuts, setConfirmResetShortcuts] = useState(false)

  const items = useSettingItems()

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return []
    const q = query.toLowerCase()
    return items.filter(
      (item) =>
        item.category.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q) ||
        (item.group?.toLowerCase().includes(q) ?? false)
    )
  }, [items, query])

  const showSearchResults = viewMode === 'search' && query.trim().length > 0

  // 같은 그룹끼리 이어진 항목을 한 카드로 묶는다.
  const sections: Section[] = []
  for (const item of items.filter((i) => i.category === activeCategory)) {
    const last = sections[sections.length - 1]
    if (last && last.group === item.group) last.items.push(item)
    else sections.push({ group: item.group, items: [item] })
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      style={{ willChange: 'opacity' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.div
        style={{ willChange: 'transform, opacity' }}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[560px] max-h-[calc(100vh-48px)] w-[720px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      >
        <div className="flex w-[176px] shrink-0 flex-col gap-0.5 bg-bg-soft px-2.5 py-3.5">
          <div className="relative mb-2.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="4.9" />
              <path d="M11.6 11.6L15.5 15.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setViewMode(e.target.value.trim().length > 0 ? 'search' : 'category')
              }}
              placeholder="설정 검색"
              className="h-[30px] w-full rounded-lg bg-text/[0.07] pl-8 pr-7 text-[13px] text-text outline-none transition-shadow placeholder:text-text-tertiary focus:ring-1 focus:ring-accent/60"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setViewMode('category')
                }}
                title="지우기 (전체 보기)"
                className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-text-tertiary hover:text-text"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            )}
          </div>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setActiveCategory(cat)
                setViewMode('category')
              }}
              className={`h-[30px] w-full rounded-lg px-2.5 text-left text-[13px] outline-none transition-colors ${
                !showSearchResults && activeCategory === cat
                  ? 'bg-bg-mute text-text'
                  : 'text-text-secondary hover:bg-bg-mute/60 hover:text-text'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between pl-7 pr-3.5">
            <h2 className="text-[17px] font-medium text-text">
              {showSearchResults ? '검색 결과' : activeCategory}
            </h2>
            <button
              type="button"
              onClick={onClose}
              title="닫기 (Esc)"
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg-mute hover:text-text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pl-7 pr-4 pb-6 pt-1 [scrollbar-color:transparent_transparent] [scrollbar-width:thin] hover:[scrollbar-color:var(--color-border-strong)_transparent]">
            {showSearchResults ? (
              filtered.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-text-tertiary">
                  검색 결과가 없어요
                </p>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} className="mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory(item.category)
                        setViewMode('category')
                      }}
                      className="mb-1.5 ml-0.5 text-[11.5px] text-text-tertiary transition-colors hover:text-accent"
                    >
                      {[item.category, item.group, item.label].filter(Boolean).join(' › ')}
                    </button>
                    <Card>{item.render()}</Card>
                  </div>
                ))
              )
            ) : (
              <>
                {sections.map((sec, i) => (
                  <section key={`${sec.group ?? 'none'}-${i}`} className="mb-5">
                    {sec.group && (
                      <div className="mb-2 flex items-center justify-between px-0.5 text-xs text-text-tertiary">
                        <span>{sec.group}</span>
                        {(sec.group === '에디터' || sec.group === '프리뷰') && (
                          <button
                            type="button"
                            onClick={sec.group === '에디터' ? resetEditorFont : resetPreviewFont}
                            className="transition-colors hover:text-accent"
                          >
                            기본값으로
                          </button>
                        )}
                      </div>
                    )}
                    <Card>
                      {sec.items.map((item) => (
                        <div key={item.id}>{item.render()}</div>
                      ))}
                    </Card>
                  </section>
                ))}
                {activeCategory === '단축키' && (
                  <button
                    type="button"
                    onClick={() => setConfirmResetShortcuts(true)}
                    className="h-8 rounded-lg bg-bg-mute px-3 text-[13px] text-text-secondary outline-none transition-colors hover:text-danger"
                  >
                    모두 기본값으로
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {confirmResetShortcuts && (
          <ConfirmDialog
            title="단축키 초기화"
            icon="reset"
            message="모든 단축키를 기본값으로 되돌려요."
            confirmLabel="초기화"
            danger
            onConfirm={() => {
              resetAllShortcuts()
              setConfirmResetShortcuts(false)
            }}
            onCancel={() => setConfirmResetShortcuts(false)}
          />
        )}
      </motion.div>
    </motion.div>
  )
}
