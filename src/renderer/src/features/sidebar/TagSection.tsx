import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { TreeNode } from '../../types/workspace'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { splitName, fileNameOf } from '@renderer/utils/path'
import ChevronIcon from '../../icons/chevron.svg?react'
import { useSettingsStore } from '../../stores/settingsStore'
import { useNotePropsStore } from '../../stores/notePropsStore'
import {
  PROPERTY_COLORS,
  PROPERTY_LABELS,
  findOption,
  type NoteProps
} from '../../utils/noteProperties'

type GroupBy = 'status' | 'priority'

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
  const options = useSettingsStore((s) => s.propertyOptions)
  const byPath = useNotePropsStore((s) => s.byPath)
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const groups = useMemo(() => {
    const existing = collectFiles(tree, new Set())
    const notes = Object.entries(byPath)
      .filter(([path, props]) => existing.has(path) && props[groupBy])
      .sort(([a], [b]) => fileNameOf(a).localeCompare(fileNameOf(b)))
    return options[groupBy]
      .map((option) => ({
        option,
        notes: notes.filter(([, props]) => props[groupBy] === option.label)
      }))
      .filter((g) => g.notes.length > 0)
  }, [tree, byPath, options, groupBy])

  const toggleGroup = (label: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const metaOf = (props: NoteProps): { label: string; color: string }[] => {
    const keys =
      groupBy === 'status'
        ? (['substatus', 'priority'] as const)
        : (['status', 'substatus'] as const)
    return keys.flatMap((key) => {
      const option = findOption(options, key, props[key])
      return option ? [{ label: option.label, color: PROPERTY_COLORS[option.color] }] : []
    })
  }

  return (
    <div
      className="flex flex-col"
      onKeyDown={(e) => e.stopPropagation()}
      onDragOver={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 px-4 pb-1">
        {(['status', 'priority'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setGroupBy(key)
              setCollapsed(new Set())
            }}
            className={`rounded px-1.5 py-0.5 text-[11px] transition-colors ${
              groupBy === key
                ? 'bg-bg-mute text-text'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {PROPERTY_LABELS[key]}
          </button>
        ))}
      </div>
      {groups.length === 0 && (
        <p className="px-4 py-2 text-[12px] text-text-tertiary">
          태그바에서 {PROPERTY_LABELS[groupBy]}를 지정한 노트가 여기 모여요
        </p>
      )}
      <div className="px-2">
        {groups.map(({ option, notes }) => {
          const open = !collapsed.has(option.label)
          return (
            <div key={option.label}>
              <button
                type="button"
                onClick={() => toggleGroup(option.label)}
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
