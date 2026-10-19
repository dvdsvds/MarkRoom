import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'
import { useSnippetPreview } from '../utils/cssSnippets'

const STYLE_ID = 'markroom-css-snippets'

/**
 * 켜진 CSS 스니펫을 <head> 맨 끝의 <style> 하나에 넣는다. 기본 CSS보다 뒤라 덮어쓸 수 있다.
 * 편집 중인 스니펫은 저장 전 내용으로 미리 반영한다(꺼져 있어도 편집하는 동안은 보인다).
 */
export function useAppliedSnippets(): void {
  const snippets = useSettingsStore((s) => s.snippets)
  const preview = useSnippetPreview((s) => s.preview)

  useEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
    }
    // 다른 스타일이 나중에 붙어도 항상 마지막에 오게 다시 붙인다
    document.head.append(style)
    const parts = snippets
      .filter((s) => (preview?.id === s.id ? true : s.enabled))
      .map(
        (s) => `/* ${s.name.replace(/\*\//g, '')} */\n${preview?.id === s.id ? preview.css : s.css}`
      )
    if (preview && !snippets.some((s) => s.id === preview.id)) parts.push(preview.css)
    style.textContent = parts.join('\n\n')
  }, [snippets, preview])
}
