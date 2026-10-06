import { motion } from 'motion/react'
import { useSettingsStore, type ThemePreference } from '../stores/settingsStore'
import ThemeDarkIcon from '../icons/theme-dark.svg?react'
import ThemeLightIcon from '../icons/theme-light.svg?react'
import ThemeSystemIcon from '../icons/theme-system.svg?react'

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  {
    value: 'system',
    label: '시스템',
    icon: (
      <ThemeSystemIcon/>
    )
  },
  {
    value: 'light',
    label: '라이트',
    icon: (
      <ThemeLightIcon/>
    )
  },
  {
    value: 'dark',
    label: '다크',
    icon: (
      <ThemeDarkIcon/>
    )
  }
]

export function ThemeToggle(): React.JSX.Element {
  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)

  return (
    <div className="titlebar-no-drag relative inline-flex rounded-full border border-border bg-bg-soft p-1">
      {OPTIONS.map((option) => {
        const active = option.value === theme
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            title={option.label}
            className="relative z-10 flex items-center justify-center rounded-full px-4 py-2 text-text-secondary transition-colors [&_svg]:h-5 [&_svg]:w-5"
            style={active ? { color: 'var(--color-text-inverted)' } : undefined}
          >
            {active && (
              <motion.span
                layoutId="theme-toggle-active"
                className="absolute inset-0 -z-10 rounded-full bg-accent"
                transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
              />
            )}
            {option.icon}
          </button>
        )
      })}
    </div>
  )
}