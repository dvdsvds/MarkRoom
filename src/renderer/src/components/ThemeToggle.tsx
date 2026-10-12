import { useSettingsStore, type ThemePreference } from '../stores/settingsStore'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' }
]

const ITEM_WIDTH = 60

export function ThemeToggle(): React.JSX.Element {
  const theme = useSettingsStore((state) => state.theme)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const activeIndex = Math.max(
    0,
    OPTIONS.findIndex((o) => o.value === theme)
  )

  return (
    <div
      role="radiogroup"
      className="titlebar-no-drag relative inline-flex rounded-[9px] bg-text/[0.07] p-0.5"
    >
      <span
        aria-hidden="true"
        className="absolute left-0.5 top-0.5 h-6 rounded-[7px] bg-text/[0.13] transition-transform duration-150 ease-out"
        style={{ width: ITEM_WIDTH, transform: `translateX(${activeIndex * ITEM_WIDTH}px)` }}
      />
      {OPTIONS.map((option) => {
        const active = option.value === theme
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={`relative h-6 rounded-[7px] text-[12.5px] outline-none transition-colors ${
              active ? 'text-text' : 'text-text-secondary hover:text-text'
            }`}
            style={{ width: ITEM_WIDTH }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}