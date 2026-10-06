import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'

/**
 * UI 전체 확대/축소 (기획 문서 8장: 50%~200%, 10% 단위, 전역 설정으로
 * 기억). Electron은 Chromium 기반이라 비표준 CSS `zoom` 속성을 그대로
 * 쓸 수 있어서, 레이아웃 전체를 다시 짤 필요 없이 body에 적용한다.
 */
export function useAppliedZoom(): void {
  const uiZoom = useSettingsStore((s) => s.uiZoom)

  useEffect(() => {
    document.body.style.setProperty('zoom', String(uiZoom / 100))
  }, [uiZoom])
}
