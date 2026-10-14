import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { useSettingsStore } from '../stores/settingsStore'
import { ConfirmDialog } from './ConfirmDialog'
import { useSettingItems, type Category } from './settings/useSettingItems'
import { SettingsNav } from './settings/SettingsNav'
import { SettingsContent, type Section } from './settings/SettingsContent'

interface SettingsPanelProps {
  onClose: () => void
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
        <SettingsNav
          query={query}
          onQueryChange={(value) => {
            setQuery(value)
            setViewMode(value.trim().length > 0 ? 'search' : 'category')
          }}
          onQueryClear={() => {
            setQuery('')
            setViewMode('category')
          }}
          activeCategory={activeCategory}
          highlightCategory={!showSearchResults}
          onSelectCategory={(cat) => {
            setActiveCategory(cat)
            setViewMode('category')
          }}
        />
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

        <SettingsContent
          showSearchResults={showSearchResults}
          filtered={filtered}
          sections={sections}
          activeCategory={activeCategory}
          onGoCategory={(cat) => {
            setActiveCategory(cat)
            setViewMode('category')
          }}
          onResetEditorFont={resetEditorFont}
          onResetPreviewFont={resetPreviewFont}
          onResetShortcuts={() => setConfirmResetShortcuts(true)}
        />
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
