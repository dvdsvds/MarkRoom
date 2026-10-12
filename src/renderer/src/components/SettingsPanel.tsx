import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastStore } from '../stores/toastStore'
import { motion } from 'motion/react'
import { useSettingsStore } from '../stores/settingsStore'
import { ShortcutRow } from './ShortcutRow'
import { ConfirmDialog } from './ConfirmDialog'
import { FileTypeIcon } from './FileTypeIcon'
import { SHORTCUT_LABELS, type ShortcutAction } from '../utils/shortcuts'
import { ThemeToggle } from './ThemeToggle'

interface SettingsPanelProps {
  onClose: () => void
}

const SHORTCUT_ACTIONS: ShortcutAction[] = [
  'newNote',
  'toggleSettings',
  'copyPathAbsolute',
  'copyPathRelative',
  'save',
  'search',
  'zoomIn',
  'zoomOut',
  'zoomReset',
  'diffApply',
  'diffRestore',
  'toggleToc'
]

const CATEGORIES = ['일반', '화면', '상태 표시줄', '단축키'] as const
type Category = (typeof CATEGORIES)[number]

interface SettingItem {
  id: string
  category: Category
  group?: string
  label: string
  render: () => React.ReactNode
}

interface Section {
  group?: string
  items: SettingItem[]
}

const INPUT =
  'h-7 rounded-lg bg-text/[0.07] px-2.5 text-[13px] text-text outline-none transition-shadow focus:ring-1 focus:ring-accent/60'

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-bg-mute/60">
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-3.5 text-[13.5px] text-text">
      <span>{label}</span>
      {children}
    </div>
  )
}

function NumberField({
  value,
  onChange,
  step = 1,
  min,
  max
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}): React.JSX.Element {
  return (
    <input
      type="number"
      value={value}
      step={step}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value)
        if (!Number.isNaN(n)) onChange(n)
      }}
      className={`${INPUT} w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
    />
  )
}

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-5 w-[34px] shrink-0 rounded-full outline-none transition-colors ${
        checked ? 'bg-accent' : 'bg-text/20'
      }`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function Checkbox({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: () => void
  label: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="group flex items-center gap-2.5 outline-none"
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors ${
          checked ? 'border-accent bg-accent' : 'border-text/30 group-hover:border-text/50'
        }`}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-bg transition-opacity ${checked ? 'opacity-100' : 'opacity-0'}`}
        >
          <path d="M2 5.3l2 2L8 3" />
        </svg>
      </span>
      {label}
    </button>
  )
}

function SubRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-[38px] items-center border-t border-border pl-10 pr-3.5 text-[13px] text-text-secondary">
      {children}
    </div>
  )
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const vimMode = useSettingsStore((s) => s.vimMode)
  const showToolbar = useSettingsStore((s) => s.showToolbar)
  const setShowToolbar = useSettingsStore((s) => s.setShowToolbar)
  const setVimMode = useSettingsStore((s) => s.setVimMode)
  const vimMouse = useSettingsStore((s) => s.vimMouse)
  const setVimMouse = useSettingsStore((s) => s.setVimMouse)
  const editorFontFamily = useSettingsStore((s) => s.editorFontFamily)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const editorLineHeight = useSettingsStore((s) => s.editorLineHeight)
  const setEditorFont = useSettingsStore((s) => s.setEditorFont)
  const previewFontFamily = useSettingsStore((s) => s.previewFontFamily)
  const previewFontSize = useSettingsStore((s) => s.previewFontSize)
  const previewLineHeight = useSettingsStore((s) => s.previewLineHeight)
  const setPreviewFont = useSettingsStore((s) => s.setPreviewFont)
  const resetEditorFont = useSettingsStore((s) => s.resetEditorFont)
  const resetPreviewFont = useSettingsStore((s) => s.resetPreviewFont)
  const showLineCol = useSettingsStore((s) => s.showLineCol)
  const toggleShowLineCol = useSettingsStore((s) => s.toggleShowLineCol)
  const showWordCount = useSettingsStore((s) => s.showWordCount)
  const toggleShowWordCount = useSettingsStore((s) => s.toggleShowWordCount)
  const showCharCount = useSettingsStore((s) => s.showCharCount)
  const toggleShowCharCount = useSettingsStore((s) => s.toggleShowCharCount)
  const charCountIncludeSpaces = useSettingsStore((s) => s.charCountIncludeSpaces)
  const toggleCharCountIncludeSpaces = useSettingsStore((s) => s.toggleCharCountIncludeSpaces)
  const charCountExcludeSpaces = useSettingsStore((s) => s.charCountExcludeSpaces)
  const toggleCharCountExcludeSpaces = useSettingsStore((s) => s.toggleCharCountExcludeSpaces)
  const resetAllShortcuts = useSettingsStore((s) => s.resetAllShortcuts)

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category>('일반')
  const [viewMode, setViewMode] = useState<'search' | 'category'>('category')
  const [confirmResetShortcuts, setConfirmResetShortcuts] = useState(false)
  const pushToast = useToastStore((s) => s.push)
  const [historyDir, setHistoryDir] = useState('')

  useEffect(() => {
    void window.api.workspace.getHistoryDir().then(setHistoryDir)
  }, [])

  const applyHistoryDir = useCallback(
    async (dir: string | null): Promise<void> => {
      const result = await window.api.workspace.setHistoryDir(dir)
      if (result.ok) {
        setHistoryDir(result.path)
        pushToast({ kind: 'info', message: '버전 기록을 새 위치로 옮겼어요.' })
      } else {
        pushToast({ kind: 'info', message: result.error })
      }
    },
    [pushToast]
  )

  const handleChangeHistoryDir = useCallback(async (): Promise<void> => {
    const picked = await window.api.workspace.pickFolder()
    if (picked) await applyHistoryDir(picked)
  }, [applyHistoryDir])

  const handleResetHistoryDir = useCallback((): void => {
    void applyHistoryDir(null)
  }, [applyHistoryDir])

  const items: SettingItem[] = useMemo(
    () => [
      {
        id: 'show-toolbar',
        category: '일반',
        group: '에디터',
        label: '서식 툴바',
        render: () => (
          <Row label="서식 툴바">
            <Toggle checked={showToolbar} onChange={() => setShowToolbar(!showToolbar)} />
          </Row>
        )
      },
      {
        id: 'vim-mode',
        category: '일반',
        group: 'Vim',
        label: 'Vim 모드',
        render: () => (
          <Row label="Vim 모드">
            <Toggle checked={vimMode} onChange={() => setVimMode(!vimMode)} />
          </Row>
        )
      },
      {
        id: 'vim-mouse',
        category: '일반',
        group: 'Vim',
        label: '마우스 사용',
        render: () => (
          <Row label="마우스 사용">
            <Toggle checked={vimMouse} onChange={() => setVimMouse(!vimMouse)} />
          </Row>
        )
      },
      {
        id: 'history-dir',
        category: '일반',
        group: '버전 기록',
        label: '기록 저장 위치',
        render: () => (
          <div className="px-3.5 py-3">
            <div className="text-[13.5px] text-text">기록 저장 위치</div>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-text/[0.07] px-2.5">
                <FileTypeIcon name="" kind="folder" size={16} />
                <span
                  className="min-w-0 flex-1 truncate text-[12.5px] text-text-secondary"
                  title={historyDir}
                >
                  {historyDir || '…'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleChangeHistoryDir}
                className="h-8 shrink-0 rounded-lg bg-accent-soft px-3 text-[13px] font-medium text-accent outline-none transition-[filter] hover:brightness-110"
              >
                폴더 변경
              </button>
              <button
                type="button"
                onClick={handleResetHistoryDir}
                className="h-8 shrink-0 rounded-lg px-2.5 text-[13px] text-text-secondary outline-none transition-colors hover:bg-bg-mute hover:text-text"
              >
                기본값으로
              </button>
            </div>
          </div>
        )
      },
      {
        id: 'theme',
        category: '화면',
        group: '테마',
        label: '색상 모드',
        render: () => (
          <Row label="색상 모드">
            <ThemeToggle />
          </Row>
        )
      },
      {
        id: 'editor-font-family',
        category: '화면',
        group: '에디터',
        label: '글꼴',
        render: () => (
          <Row label="글꼴">
            <input
              value={editorFontFamily}
              onChange={(e) => setEditorFont({ family: e.target.value })}
              className={`${INPUT} w-64 text-[12.5px] text-text-secondary focus:text-text`}
            />
          </Row>
        )
      },
      {
        id: 'editor-font-size',
        category: '화면',
        group: '에디터',
        label: '글꼴 크기',
        render: () => (
          <Row label="글꼴 크기">
            <NumberField
              value={editorFontSize}
              min={8}
              max={40}
              onChange={(v) => setEditorFont({ size: v })}
            />
          </Row>
        )
      },
      {
        id: 'editor-line-height',
        category: '화면',
        group: '에디터',
        label: '줄 간격',
        render: () => (
          <Row label="줄 간격">
            <NumberField
              value={editorLineHeight}
              step={0.1}
              min={1}
              max={3}
              onChange={(v) => setEditorFont({ lineHeight: v })}
            />
          </Row>
        )
      },
      {
        id: 'preview-font-family',
        category: '화면',
        group: '프리뷰',
        label: '글꼴',
        render: () => (
          <Row label="글꼴">
            <input
              value={previewFontFamily}
              onChange={(e) => setPreviewFont({ family: e.target.value })}
              className={`${INPUT} w-64 text-[12.5px] text-text-secondary focus:text-text`}
            />
          </Row>
        )
      },
      {
        id: 'preview-font-size',
        category: '화면',
        group: '프리뷰',
        label: '글꼴 크기',
        render: () => (
          <Row label="글꼴 크기">
            <NumberField
              value={previewFontSize}
              min={8}
              max={40}
              onChange={(v) => setPreviewFont({ size: v })}
            />
          </Row>
        )
      },
      {
        id: 'preview-line-height',
        category: '화면',
        group: '프리뷰',
        label: '줄 간격',
        render: () => (
          <Row label="줄 간격">
            <NumberField
              value={previewLineHeight}
              step={0.1}
              min={1}
              max={3}
              onChange={(v) => setPreviewFont({ lineHeight: v })}
            />
          </Row>
        )
      },
      {
        id: 'show-line-col',
        category: '상태 표시줄',
        label: '줄·열 위치',
        render: () => (
          <Row label="줄·열 위치">
            <Toggle checked={showLineCol} onChange={toggleShowLineCol} />
          </Row>
        )
      },
      {
        id: 'show-word-count',
        category: '상태 표시줄',
        label: '단어 수',
        render: () => (
          <Row label="단어 수">
            <Toggle checked={showWordCount} onChange={toggleShowWordCount} />
          </Row>
        )
      },
      {
        id: 'show-char-count',
        category: '상태 표시줄',
        label: '글자 수',
        render: () => (
          <div>
            <Row label="글자 수">
              <Toggle checked={showCharCount} onChange={toggleShowCharCount} />
            </Row>
            {showCharCount && (
              <>
                <SubRow>
                  <Checkbox
                    checked={charCountIncludeSpaces}
                    onChange={toggleCharCountIncludeSpaces}
                    label="공백 포함"
                  />
                </SubRow>
                <SubRow>
                  <Checkbox
                    checked={charCountExcludeSpaces}
                    onChange={toggleCharCountExcludeSpaces}
                    label="공백 제외"
                  />
                </SubRow>
              </>
            )}
          </div>
        )
      },
      ...SHORTCUT_ACTIONS.map((action): SettingItem => ({
        id: `shortcut-${action}`,
        category: '단축키',
        label: SHORTCUT_LABELS[action],
        render: () => <ShortcutRow action={action} />
      }))
    ],
    [
      showToolbar,
      setShowToolbar,
      vimMode,
      setVimMode,
      vimMouse,
      setVimMouse,
      editorFontFamily,
      editorFontSize,
      editorLineHeight,
      setEditorFont,
      previewFontFamily,
      previewFontSize,
      previewLineHeight,
      setPreviewFont,
      showLineCol,
      toggleShowLineCol,
      showWordCount,
      toggleShowWordCount,
      showCharCount,
      toggleShowCharCount,
      charCountIncludeSpaces,
      toggleCharCountIncludeSpaces,
      charCountExcludeSpaces,
      toggleCharCountExcludeSpaces,
      historyDir,
      handleChangeHistoryDir,
      handleResetHistoryDir
    ]
  )

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