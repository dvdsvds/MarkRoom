import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'

/**
 * settingsStore의 글꼴 설정을 CSS 변수(assets/theme.css의 기본값)에
 * 덮어쓴다. MarkdownEditor와 MarkdownPreview는 그 변수를 읽기만 한다.
 */
export function useAppliedFonts(): void {
  const editorFontFamily = useSettingsStore((s) => s.editorFontFamily)
  const editorFontSize = useSettingsStore((s) => s.editorFontSize)
  const editorLineHeight = useSettingsStore((s) => s.editorLineHeight)
  const previewFontFamily = useSettingsStore((s) => s.previewFontFamily)
  const previewFontSize = useSettingsStore((s) => s.previewFontSize)
  const previewLineHeight = useSettingsStore((s) => s.previewLineHeight)

  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--font-editor', editorFontFamily)
    root.setProperty('--editor-font-size', `${editorFontSize}px`)
    root.setProperty('--editor-line-height', String(editorLineHeight))
    root.setProperty('--font-preview', previewFontFamily)
    root.setProperty('--preview-font-size', `${previewFontSize}px`)
    root.setProperty('--preview-line-height', String(previewLineHeight))
  }, [
    editorFontFamily,
    editorFontSize,
    editorLineHeight,
    previewFontFamily,
    previewFontSize,
    previewLineHeight
  ])
}
