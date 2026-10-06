import { useState } from 'react'
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

/** VS Code 방식 탭. 저장 안 된 변경이 있으면 점(•)으로, 파일이 사라졌으면
 * 빨간 취소선으로 표시한다 (기획 문서 8장). */
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
              },
              {
                label: '상대 경로 복사',
                onClick: () =>
                  void window.api.workspace.copyPath(contextMenu.tab.filePath as string, true)
              }
            ]
          : [])
      ]
    : []

  return (
    <div className="flex h-7 shrink-0 items-stretch overflow-x-auto border-b border-border bg-bg-soft">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <div
            key={tab.id}
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
            className={`group flex min-w-0 max-w-[180px] shrink-0 cursor-pointer items-center gap-2 border-r border-b-2 border-r-border pl-3 pr-2 text-xs ${
              isActive ? 'border-b-accent bg-bg text-text' : 'border-b-transparent text-text-secondary hover:bg-bg-mute'
            }`}
          >
            <span
              className={`truncate ${tab.missing ? 'text-danger line-through' : ''}`}
              title={tab.missing ? '파일이 없어요' : undefined}
            >
              {tabLabel(tab)}
            </span>
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              {tab.dirty && <span className="h-2.5 w-2.5 translate-y-px rounded-full bg-text-tertiary group-hover:hidden"/>}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
                title="닫기"
                className={`absolute inset-0 flex translate-y-px items-center justify-center rounded text-text-tertiary hover:text-text ${
                  tab.dirty
                  ? 'hidden group-hover:flex'
                  : isActive
                    ? 'flex'
                      : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                ✕
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
