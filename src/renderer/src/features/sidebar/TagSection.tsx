import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { TreeNode } from '../../types/workspace'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { splitName, fileNameOf } from '@renderer/utils/path'
import ChevronIcon from '../../icons/chevron.svg?react'
import { useSettingsStore, type TagGroupBy } from '../../stores/settingsStore'
import { useNotePropsStore } from '../../stores/notePropsStore'
import { PROPERTY_COLORS, findOption, type NoteProps } from '../../utils/noteProperties'

const ROW_BASE =
  'flex h-7 w-full items-center gap-2 rounded-md pr-2 text-left text-[13px] text-text transition-colors hover:bg-bg-mute/60 focus:outline-none'

function collectFiles(nodes: TreeNode[], out: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.type === 'file') out.add(node.path)
    else if (node.children) collectFiles(node.children, out)
  }
  return out
}

export function TagSection({
  tree,
  activeFilePath,
  onOpenFile
}: {
  tree: TreeNode[]
  activeFilePath: string | null
  onOpenFile: (filePath: string) => void
}): React.JSX.Element {
  const defs = useSettingsStore((s) => s.propertyDefs)
  const byPath = useNotePropsStore((s) => s.byPath)
  const savedGroupBy: TagGroupBy = useSettingsStore((s) => s.tagGroupBy)
  const setGroupBy = useSettingsStore((s) => s.setTagGroupBy)
  const toggleTagGroup = useSettingsStore((s) => s.toggleTagGroup)
  const collapsedGroups = useSettingsStore((s) => s.tagCollapsedGroups)

  // 선택 타입 속성이면 무엇으로든 묶어 볼 수 있다. 저장된 기준이 지워졌으면 첫 번째로 돌아간다
  const groupDefs = defs.filter((d) => d.type === 'select')
  const groupDef = groupDefs.find((d) => d.id === savedGroupBy) ?? groupDefs[0]
  const groupBy = groupDef?.id ?? ''
  const collapsed = collapsedGroups[groupBy] ?? []

  const groups = useMemo(() => {
    const selects = defs.filter((d) => d.type === 'select')
    const def = selects.find((d) => d.id === savedGroupBy) ?? selects[0]
    if (!def) return []
    const existing = collectFiles(tree, new Set())
    const notes = Object.entries(byPath)
      .filter(([path, props]) => existing.has(path) && props[def.id])
      .sort(([a], [b]) => fileNameOf(a).localeCompare(fileNameOf(b)))
    return (def.options ?? [])
      .map((option) => ({
        option,
        notes: notes.filter(([, props]) => props[def.id] === option.label)
      }))
      .filter((g) => g.notes.length > 0)
  }, [tree, byPath, defs, savedGroupBy])

  // 오른쪽에 다른 선택 속성 값을 두 개까지 작게 보여 준다
  const metaOf = (props: NoteProps): { label: string; color: string }[] =>
    groupDefs
      .filter((d) => d.id !== groupBy)
      .flatMap((d) => {
        const option = findOption(d, props[d.id])
        return option ? [{ label: option.label, color: PROPERTY_COLORS[option.color] }] : []
      })
      .slice(0, 2)

  return (
    <div
      className="flex flex-col"
      onKeyDown={(e) => e.stopPropagation()}
      onDragOver={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1 px-4 pb-1">
        {groupDefs.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setGroupBy(d.id)}
            className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
              groupBy === d.id
                ? 'bg-bg-mute text-text'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>
      {groups.length === 0 && (
        <p className="px-4 py-2 text-[12px] text-text-tertiary">
          {groupDef
            ? `속성 바에서 ${groupDef.name}을(를) 지정한 노트가 여기 모여요`
            : '설정 > 속성에서 선택 타입 속성을 만들면 여기서 묶어 볼 수 있어요'}
        </p>
      )}
      <div className="px-2">
        {groups.map(({ option, notes }) => {
          const open = !collapsed.includes(option.label)
          return (
            <div key={option.label}>
              <button
                type="button"
                onClick={() => toggleTagGroup(groupBy, option.label)}
                className={ROW_BASE}
                style={{ paddingLeft: 8 }}
              >
                <ChevronIcon
                  width={12}
                  height={12}
                  className="shrink-0 text-text-secondary transition-transform"
                  style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
                />
                <span className="font-medium" style={{ color: PROPERTY_COLORS[option.color] }}>
                  {option.label}
                </span>
                <span className="text-[12px] text-text-tertiary">{notes.length}</span>
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                    style={{ overflow: 'hidden' }}
                  >
                    {notes.map(([path, props]) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => onOpenFile(path)}
                        title={path}
                        className={`${ROW_BASE} ${path === activeFilePath ? 'bg-bg-mute' : ''}`}
                        style={{ paddingLeft: 8 + 12 + 20 }}
                      >
                        <FileTypeIcon name={fileNameOf(path)} kind="file" />
                        <span className="truncate">{splitName(fileNameOf(path)).base}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px]">
                          {metaOf(props).map((m) => (
                            <span key={m.label} style={{ color: m.color }}>
                              {m.label}
                            </span>
                          ))}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
