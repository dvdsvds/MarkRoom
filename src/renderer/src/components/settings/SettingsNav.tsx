import { CATEGORIES, type Category } from './useSettingItems'

export function SettingsNav({
  query,
  onQueryChange,
  onQueryClear,
  activeCategory,
  highlightCategory,
  onSelectCategory
}: {
  query: string
  onQueryChange: (value: string) => void
  onQueryClear: () => void
  activeCategory: Category
  highlightCategory: boolean
  onSelectCategory: (cat: Category) => void
}): React.JSX.Element {
  return (
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
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="설정 검색"
          className="h-[30px] w-full rounded-lg bg-text/[0.07] pl-8 pr-7 text-[13px] text-text outline-none transition-shadow placeholder:text-text-tertiary focus:ring-1 focus:ring-accent/60"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={onQueryClear}
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
          onClick={() => onSelectCategory(cat)}
          className={`h-[30px] w-full rounded-lg px-2.5 text-left text-[13px] outline-none transition-colors ${
            highlightCategory && activeCategory === cat
              ? 'bg-bg-mute text-text'
              : 'text-text-secondary hover:bg-bg-mute/60 hover:text-text'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}