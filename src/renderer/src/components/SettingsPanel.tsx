import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastStore } from '../stores/toastStore'
import { motion } from 'motion/react'
import { useSettingsStore } from '../stores/settingsStore'
import { ShortcutRow } from './ShortcutRow'
import { ConfirmDialog } from './ConfirmDialog'
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

const CATEGORIES = ['일반', '화면', '상태 표시줄',  '단축키'] as const
type Category = (typeof CATEGORIES)[number]

interface SettingItem {
  id: string
  category: Category
  group?: string
  label: string
  render: () => React.ReactNode
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="py-3 text-sm text-text">
      <div className="text-[13px] font-medium">{label}</div>
      <div className="mt-2">{children}</div>
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
      className="w-20 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
      onClick={onChange}
        className={`relative h-5 w-9 shrink-0 overflow-hidden rounded-full transition-colors ${
        checked ? 'bg-accent' : 'bg-bg-mute'
      }`}
    >
      <span
        className="absolute left-0 top-0 rounded-full bg-white shadow transition-transform"
        style={{
          width: 16,
          height: 16,
          transform: checked ? 'translate(18px, 2px)' : 'translate(2px, 2px)'
        }}
      />
    </button>
  )
}

export function SettingsPanel({ onClose }: SettingsPanelProps): React.JSX.Element {
  const vimMode = useSettingsStore((s) => s.vimMode)
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
  const uiZoom = useSettingsStore((s) => s.uiZoom)
  const setUiZoom = useSettingsStore((s) => s.setUiZoom)
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
          id: 'vim-mode',
          category: '일반',
          group: 'Vim',
          label: 'Vim 모드',
          render: () => (
            <Field label="Vim 모드">
              <Toggle checked={vimMode} onChange={() => setVimMode(!vimMode)} />
            </Field>
          )
        },
        {
          id: 'vim-mouse',
          category: '일반',
          group: 'Vim',
          label: '마우스 사용',
          render: () => (
            <Field label="마우스 사용">
              <Toggle checked={vimMouse} onChange={() => setVimMouse(!vimMouse)}/>
            </Field>

          )
        },
        {
          id: 'history-dir',
          category: '일반',
          group: '버전 기록',
          label: '기록 저장 위치',
          render: () => (
            <Field label="기록 저장 위치">
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-bg-soft px-3 py-2.5">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-text-tertiary"
                >
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                </svg>
                <span className="min-w-0 flex-1 truncate text-[13px] text-text" title={historyDir}>
                  {historyDir || '…'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleChangeHistoryDir}
                  className="rounded-md bg-accent-soft px-3 py-1.5 text-[13px] font-medium text-accent hover:brightness-110 focus:outline-none"
                >
                  폴더 변경
                </button>
                <button
                  type="button"
                  onClick={handleResetHistoryDir}
                  className="rounded-md border border-border px-3 py-1.5 text-[13px] text-text-secondary hover:border-border-strong hover:text-text focus:outline-none"
                >
                  기본값으로
                </button>
              </div>
            </Field>
          )
        },
      {
        id: 'theme',
        category: '화면',
        group: '테마',
        label: '색상 모드',
        render: () => (
          <div className="py-3">
            <ThemeToggle/>
          </div>
        )
      },
      {
        id: 'editor-font-family',
        category: '화면',
        group: '에디터',
        label: '글꼴',
        render: () => (
          <Field label="글꼴">
            <input
              value={editorFontFamily}
              onChange={(e) => setEditorFont({ family: e.target.value })}
              className="w-96 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
          </Field>
        )
      },
      {
        id: 'editor-font-size',
        category: '화면',
        group: '에디터',
        label: '글꼴 크기',
        render: () => (
          <Field label="글꼴 크기">
            <NumberField
              value={editorFontSize}
              min={8}
              max={40}
              onChange={(v) => setEditorFont({ size: v })}
            />
          </Field>
        )
      },
      {
        id: 'editor-line-height',
        category: '화면',
        group: '에디터',
        label: '줄 간격',
        render: () => (
          <Field label="줄 간격">
            <NumberField
              value={editorLineHeight}
              step={0.1}
              min={1}
              max={3}
              onChange={(v) => setEditorFont({ lineHeight: v })}
            />
          </Field>
        )
      },
      {
        id: 'preview-font-family',
        category: '화면',
        group: '프리뷰',
        label: '글꼴',
        render: () => (
          <Field label="글꼴">
            <input
              value={previewFontFamily}
              onChange={(e) => setPreviewFont({ family: e.target.value })}
              className="w-96 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent"
            />
          </Field>
        )
      },
      {
        id: 'preview-font-size',
        category: '화면',
        group: '프리뷰',
        label: '글꼴 크기',
        render: () => (
          <Field label="글꼴 크기">
            <NumberField
              value={previewFontSize}
              min={8}
              max={40}
              onChange={(v) => setPreviewFont({ size: v })}
            />
          </Field>
        )
      },
      {
        id: 'preview-line-height',
        category: '화면',
        group: '프리뷰',
        label: '줄 간격',
        render: () => (
          <Field label="줄 간격">
            <NumberField
              value={previewLineHeight}
              step={0.1}
              min={1}
              max={3}
              onChange={(v) => setPreviewFont({ lineHeight: v })}
            />
          </Field>
        )
      },
      {
        id: 'show-line-col',
        category: '상태 표시줄',
        label: '줄·열 위치',
        render: () => (
          <Field label="줄·열 위치">
            <Toggle checked={showLineCol} onChange={toggleShowLineCol} />
          </Field>
        )
      },
      {
        id: 'show-word-count',
        category: '상태 표시줄',
        label: '단어 수',
        render: () => (
          <Field label="단어 수">
            <Toggle checked={showWordCount} onChange={toggleShowWordCount} />
          </Field>
        )
      },
      {
        id: 'show-char-count',
        category: '상태 표시줄',
        label: '글자 수',
        render: () => (
          <div>
            <Field label="글자 수">
              <Toggle checked={showCharCount} onChange={toggleShowCharCount} />
            </Field>
            {showCharCount && (
              <div className="mt-1 flex flex-col gap-1 pl-3 text-xs text-text-secondary">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={charCountIncludeSpaces}
                    onChange={toggleCharCountIncludeSpaces}
                    className="ui-checkbox"
                  />
                  공백 포함
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={charCountExcludeSpaces}
                    onChange={toggleCharCountExcludeSpaces}
                    className="ui-checkbox"
                  />
                  공백 제외
                </label>
              </div>
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
      uiZoom,
      setUiZoom,
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
      handleResetHistoryDir,
    ]
  )

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return []
    const q = query.toLowerCase()
    return items.filter(
      (item) => item.category.toLowerCase().includes(q) || 
                item.label.toLowerCase().includes(q) ||
                (item.group?.toLowerCase().includes(q) ?? false)
    )
  }, [items, query])

  const showSearchResults = viewMode === 'search' && query.trim().length > 0
  const categoryItems = items.filter((item) => item.category === activeCategory)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', duration: 0.25, bounce: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[600px] w-[640px] flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl"
      >
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5">
        <span className="text-sm font-semibold text-text">설정</span>
        <button
          type="button"
          onClick={onClose}
          title="닫기 (Esc)"
          className="rounded px-1.5 text-text-secondary hover:bg-bg-mute hover:text-text"
        >
          ✕
        </button>
      </div>

      <div className="shrink-0 border-b border-border p-2">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setViewMode(e.target.value.trim().length > 0 ? 'search' : 'category')
            }}
            placeholder="설정 검색…"
            className="w-full rounded-md border border-border bg-bg px-2.5 py-1.5 pr-6 text-sm text-text outline-none focus:border-accent"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setViewMode('category')
              }}
              title="지우기 (전체 보기)"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-text-tertiary hover:text-text"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        {!showSearchResults && (
          <div className="flex w-36 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setActiveCategory(cat)
                  setViewMode('category')
                }}
                className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs focus:outline-none ${
                  activeCategory === cat
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-secondary hover:bg-bg-mute hover:text-text'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto px-3 py-2">
          {showSearchResults ? (
            filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-tertiary">검색 결과가 없어요</p>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((item) => (
                  <div key={item.id} className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveCategory(item.category)
                        setViewMode('category')
                      }}
                      className="text-[11px] text-text-tertiary hover:text-accent"
                    >
                      {item.category} &gt; {item.group ? `${item.group}` : ''}{item.label}
                    </button>
                    {item.render()}
                  </div>
                ))}
              </div>
            )
          ) : (
            <div>
              {categoryItems.map((item, i) => (
                <div key={item.id}>
                  {item.group && item.group !== categoryItems[i - 1]?.group && (
                    <div className={`flex items-center justify-between pb-1 pt-2 ${i === 0 ? 'pt-0' : 'mt-2 border-t border-border pt-4'}`}>
                      <span className="text-lg font-semibold text-text">{item.group}</span>
                      {(item.group === '에디터' || item.group === '프리뷰') && (
                        <button
                          type="button"
                          onClick={item.group === '에디터' ? resetEditorFont : resetPreviewFont}
                          className="text-xs text-text-tertiary hover:text-accent"
                        >
                          기본값으로
                        </button>
                      )}
                    </div>
                  )}
                  {item.render()}
                </div>
              ))}
              {activeCategory === '단축키' && (
                <div className="py-3">
                  <button
                    type="button"
                    onClick={() => setConfirmResetShortcuts(true)}
                    className="rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:border-danger hover:text-danger"
                  >
                    모두 기본값으로
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {confirmResetShortcuts && (
        <ConfirmDialog
          title="단축키 초기화"
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
    </div>
  )
}
