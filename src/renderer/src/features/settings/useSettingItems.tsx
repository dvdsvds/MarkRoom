import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastStore } from '../../stores/toastStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { ShortcutRow } from './ShortcutRow'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { SHORTCUT_LABELS, type ShortcutAction } from '../../utils/shortcuts'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Checkbox, INPUT, NumberField, Row, SubRow, Toggle } from './SettingsParts'
import { PropertyOptionsEditor } from './PropertyOptionsEditor'
import { TrashSetting } from './TrashSetting'
import { DailyNoteSetting } from './DailyNoteSetting'
import { PROPERTY_LABELS } from '../../utils/noteProperties'

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
  'toggleToc',
  'todoDashboard',
  'backlinks',
  'toggleSidebar',
  'graph',
  'dailyNote'
]

export const CATEGORIES = ['일반', '화면', '상태 표시줄', '태그', '단축키'] as const
export type Category = (typeof CATEGORIES)[number]

export interface SettingItem {
  id: string
  category: Category
  group?: string
  label: string
  render: () => React.ReactNode
}

export function useSettingItems(): SettingItem[] {
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

  return useMemo(
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
        id: 'daily-note',
        category: '일반',
        group: '데일리 노트',
        label: '데일리 노트 폴더 형식',
        render: () => <DailyNoteSetting />
      },
      {
        id: 'trash',
        category: '일반',
        group: '휴지통',
        label: '앱 휴지통',
        render: () => <TrashSetting />
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
      ...(['status', 'substatus', 'priority'] as const).map(
        (key): SettingItem => ({
          id: `property-${key}`,
          category: '태그',
          group: PROPERTY_LABELS[key],
          label: `${PROPERTY_LABELS[key]} 값`,
          render: () => <PropertyOptionsEditor propKey={key} />
        })
      ),
      ...SHORTCUT_ACTIONS.map(
        (action): SettingItem => ({
          id: `shortcut-${action}`,
          category: '단축키',
          label: SHORTCUT_LABELS[action],
          render: () => <ShortcutRow action={action} />
        })
      )
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
}