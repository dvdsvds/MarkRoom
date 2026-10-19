import { useState } from 'react'
import { ContextMenu, type ContextMenuItem } from '../../components/ContextMenu'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useSettingsStore } from '../../stores/settingsStore'
import { DAILY_TEMPLATE_ID, type NoteTemplate } from '../../utils/noteTemplate'
import { TemplateEditDialog } from './TemplateEditDialog'
import PlusIcon from '../../icons/ctx-plus.svg?react'
import RenameIcon from '../../icons/ctx-rename.svg?react'
import TrashIcon from '../../icons/ctx-trash.svg?react'
import NewFileIcon from '../../icons/new-file.svg?react'

const ROW =
  'group/tpl flex h-7 w-full items-center gap-2 rounded-md pl-2 pr-1 text-left text-[13px] text-text transition-colors hover:bg-bg-mute/60 focus:outline-none'

const ROW_BTN =
  'rounded px-1.5 py-0.5 text-[11px] text-text-tertiary opacity-0 transition-opacity hover:bg-bg-mute hover:text-text group-hover/tpl:opacity-100'

export function TemplateSection({
  onInsert,
  onCreateNote
}: {
  onInsert: (template: NoteTemplate) => void
  onCreateNote: (template: NoteTemplate) => void
}): React.JSX.Element {
  const templates = useSettingsStore((s) => s.templates)
  const saveTemplate = useSettingsStore((s) => s.saveTemplate)
  const deleteTemplate = useSettingsStore((s) => s.deleteTemplate)
  const [editing, setEditing] = useState<{ template: NoteTemplate; isNew: boolean } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; template: NoteTemplate } | null>(null)
  const [deleting, setDeleting] = useState<NoteTemplate | null>(null)

  const menuItems = (t: NoteTemplate): ContextMenuItem[] => [
    {
      label: '지금 노트에 넣기',
      icon: <PlusIcon width={16} height={16} />,
      onClick: () => onInsert(t)
    },
    {
      label: '이 템플릿으로 새 노트',
      icon: <NewFileIcon width={16} height={16} />,
      onClick: () => onCreateNote(t)
    },
    {
      label: '편집',
      icon: <RenameIcon width={16} height={16} />,
      sepBefore: true,
      onClick: () => setEditing({ template: t, isNew: false })
    },
    ...(t.id === DAILY_TEMPLATE_ID
      ? []
      : [
          {
            label: '삭제',
            icon: <TrashIcon width={16} height={16} />,
            danger: true,
            onClick: () => setDeleting(t)
          }
        ])
  ]

  return (
    <div className="px-2" onKeyDown={(e) => e.stopPropagation()}>
      {templates.map((t) => (
        <div
          key={t.id}
          role="button"
          tabIndex={0}
          onClick={() => setEditing({ template: t, isNew: false })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditing({ template: t, isNew: false })
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, template: t })
          }}
          title="눌러서 편집, 우클릭으로 더 보기"
          className={ROW}
        >
          <span className="truncate">{t.name}</span>
          {t.id === DAILY_TEMPLATE_ID && (
            <span className="shrink-0 text-[11px] text-text-tertiary">데일리 노트</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onInsert(t)
            }}
            className={`ml-auto shrink-0 ${ROW_BTN}`}
          >
            넣기
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setEditing({
            template: { id: crypto.randomUUID(), name: '', content: '# {{title}}\n\n' },
            isNew: true
          })
        }
        className="mt-0.5 h-7 w-full rounded-md pl-2 text-left text-[12.5px] text-text-tertiary transition-colors hover:text-accent"
      >
        + 템플릿 추가
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.template)}
          onClose={() => setMenu(null)}
        />
      )}
      {editing && (
        <TemplateEditDialog
          template={editing.template}
          isNew={editing.isNew}
          onSave={(t) => {
            saveTemplate(t)
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="템플릿을 삭제할까요?"
          message={`'${deleting.name}' 템플릿이 지워져요. 이 템플릿으로 만든 노트는 그대로 남아요.`}
          confirmLabel="삭제"
          danger
          onConfirm={() => {
            deleteTemplate(deleting.id)
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
