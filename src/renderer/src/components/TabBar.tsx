import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Tab } from '../stores/tabsStore'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { tabLabel } from '../utils/tabLabel'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onSelect: (tabId: string) => void
  /** X 버튼, 가운데 클릭, 우클릭 메뉴 "닫기"에서 부른다. 저장 안 된 내용이 있으면
   * 저장/저장 안 함/취소를 먼저 물어본다 (App.tsx가 처리). */
  onClose: (tabId: string) => void
  onCloseOthers: (tabId: string) => void
  onCloseToRight: (tabId: string) => void
  onCloseAll: () => void
  /** 파일이 사라진(빨간 취소선) 탭을 클릭하면. */
  onMissingClick: (tab: Tab) => void
}

function CloseGlyph(): React.JSX.Element {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    >
      <path d="M2 2l6 6M8 2l-6 6" />
    </svg>
  )
}

/** 알약 모양 탭. 저장 안 된 변경이 있으면 점(•)으로, 파일이 사라졌으면
 * 빨간 취소선으로 표시한다 (기획 문서 8장). 활성 탭 배경은 탭 사이를 부드럽게 이동한다. */
export function TabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseToRight,
  onCloseAll,
  onMissingClick
}: TabBarProps): React.JSX.Element | null {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tab: Tab } | null>(null)
  const activeRef = useRef<HTMLDivElement>(null)
  // 활성 탭 배경의 위치. 탭 줄 안쪽(스크롤 내용) 기준 좌표라서, 탭 줄이 스크롤되거나
  // 사이드바 크기가 바뀌어도 탭에 붙어 있고, 활성 탭이 바뀔 때만 미끄러진다.
  const [pill, setPill] = useState<{ left: number; width: number; top: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const el = activeRef.current
    if (!el) {
      setPill(null)
      return
    }
    const next = { left: el.offsetLeft, width: el.offsetWidth, top: el.offsetTop, height: el.offsetHeight }
    setPill((prev) =>
      prev &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.top === next.top &&
      prev.height === next.height
        ? prev
        : next
    )
  }, [activeTabId, tabs])

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [activeTabId])

  if (tabs.length === 0) return null

  const menuItems: ContextMenuItem[] = contextMenu
    ? [
        { label: '닫기', onClick: () => onClose(contextMenu.tab.id) },
        { label: '다른 탭 닫기', onClick: () => onCloseOthers(contextMenu.tab.id) },
        { label: '오른쪽 탭 닫기', onClick: () => onCloseToRight(contextMenu.tab.id) },
        { label: '모두 닫기', onClick: () => onCloseAll() },
        ...(contextMenu.tab.filePath
          ? [
              {
                label: '폴더에서 보기',
                onClick: () => void window.api.workspace.reveal(contextMenu.tab.filePath as string)
              },
              {
                label: '경로 복사',
                onClick: () =>
                  void window.api.workspace.copyPath(contextMenu.tab.filePath as string, false)
              }
            ]
          : [])
      ]
    : []

  return (
    <div className="relative flex h-10 shrink-0 items-center gap-1 overflow-x-auto px-2">
      {pill && (
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{ x: pill.left, width: pill.width }}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          style={{ top: pill.top, height: pill.height }}
          className="pointer-events-none absolute left-0 rounded-md bg-bg-mute"
        />
      )}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => (tab.missing ? onMissingClick(tab) : onSelect(tab.id))}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                onClose(tab.id)
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu({ x: e.clientX, y: e.clientY, tab })
            }}
            className={`group relative flex h-7 min-w-0 max-w-[180px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md pl-2.5 pr-1.5 text-[12.5px] transition-colors ${
              isActive
                ? 'text-text'
                : 'text-text-tertiary hover:bg-bg-mute hover:text-text-secondary'
            }`}
          >
            <span
              className={`relative truncate ${tab.missing ? 'text-danger line-through' : ''}`}
              title={tab.missing ? '파일이 없어요' : undefined}
            >
              {tabLabel(tab)}
            </span>
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              {tab.dirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary group-hover:hidden" />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
                title="닫기"
                className={`absolute inset-0 items-center justify-center rounded text-text-tertiary hover:bg-bg-mute hover:text-text ${
                  tab.dirty
                    ? 'hidden group-hover:flex'
                    : isActive
                      ? 'flex'
                      : 'flex opacity-0 group-hover:opacity-100'
                }`}
              >
                <CloseGlyph />
              </button>
            </span>
          </div>
        )
      })}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}