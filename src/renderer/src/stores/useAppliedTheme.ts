import { useEffect } from 'react'
import { useSettingsStore } from './settingsStore'

/**
 * settingsStore의 theme 값을 <html data-theme="..."> 속성에 반영한다.
 * 'system'이면 속성을 지워서 assets/theme.css의 prefers-color-scheme
 * 분기가 그대로 적용되게 한다.
 */
export function useAppliedTheme(): void {
  const theme = useSettingsStore((state) => state.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])
}
