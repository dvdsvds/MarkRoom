import { useCallback, useMemo, useRef, useState } from 'react'
import { diffToRows, type DiffRow } from '../utils/diff'

interface DiffContentProps {
  oldContent: string
  newContent: string
  oldLabel: string
  newLabel: string
}

const CONTEXT = 3
const COLLAPSE_THRESHOLD = CONTEXT * 2 + 2

interface Block {
  key: number
  changed: boolean
  rows: DiffRow[]
}

function groupBlocks(rows: DiffRow[]): Block[] {
  const blocks: Block[] = []
  let i = 0
  while (i < rows.length) {
    const same = rows[i].leftType === 'same'
    let j = i
    while (j < rows.length && (rows[j].leftType === 'same') === same) j++
    blocks.push({ key: i, changed: !same, rows: rows.slice(i, j) })
    i = j
  }
  return blocks
}

function RowLine({
  text,
  type
}: {
  text: string | null
  type: 'same' | 'add' | 'remove' | 'empty'
}): React.JSX.Element {
  const bg =
    type === 'add'
      ? 'bg-[var(--color-diff-add-bg)] text-[var(--color-diff-add-text)]'
      : type === 'remove'
        ? 'bg-[var(--color-diff-remove-bg)] text-[var(--color-diff-remove-text)]'
        : ''
  return (
    <div className={`whitespace-pre-wrap px-2 py-0.5 font-mono text-xs ${bg}`}>
      {text === null || text.length === 0 ? ' ' : text}
    </div>
  )
}

function BlockRows({
  block,
  side,
  expanded,
  onExpand
}: {
  block: Block
  side: 'left' | 'right'
  expanded: boolean
  onExpand: () => void
}): React.JSX.Element {
  if (!block.changed && block.rows.length > COLLAPSE_THRESHOLD && !expanded) {
    const head = block.rows.slice(0, CONTEXT)
    const tail = block.rows.slice(-CONTEXT)
    const hiddenCount = block.rows.length - CONTEXT * 2
    return (
      <div>
        {head.map((row, i) => (
          <RowLine
            key={i}
            text={side === 'left' ? row.left : row.right}
            type={side === 'left' ? row.leftType : row.rightType}
          />
        ))}
        <button
          type="button"
          onClick={onExpand}
          className="block w-full bg-bg-mute px-2 py-1 text-left text-[11px] text-text-tertiary hover:text-accent"
        >
          … {hiddenCount}줄 접힘 (눌러서 펼치기)
        </button>
        {tail.map((row, i) => (
          <RowLine
            key={i}
            text={side === 'left' ? row.left : row.right}
            type={side === 'left' ? row.leftType : row.rightType}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {block.rows.map((row, i) => (
        <RowLine
          key={i}
          text={side === 'left' ? row.left : row.right}
          type={side === 'left' ? row.leftType : row.rightType}
        />
      ))}
    </div>
  )
}

/**
 * diff 그리드 본체(좌우 나란히 + 동기 스크롤 + 접기). 팝업 모달 차림새는
 * DiffView가, 목록 안 미리보기 자리는 RecoveryDialog가 각자 감싼다.
 */
export function DiffContent({
  oldContent,
  newContent,
  oldLabel,
  newLabel
}: DiffContentProps): React.JSX.Element {
  const rows = useMemo(() => diffToRows(oldContent, newContent), [oldContent, newContent])
  const blocks = useMemo(() => groupBlocks(rows), [rows])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef<'left' | 'right' | null>(null)

  const handleLeftScroll = useCallback((): void => {
    if (syncingRef.current === 'right') return
    const from = leftRef.current
    const to = rightRef.current
    if (!from || !to) return
    syncingRef.current = 'left'
    to.scrollTop = from.scrollTop
    requestAnimationFrame(() => {
      syncingRef.current = null
    })
  }, [])

  const handleRightScroll = useCallback((): void => {
    if (syncingRef.current === 'left') return
    const from = rightRef.current
    const to = leftRef.current
    if (!from || !to) return
    syncingRef.current = 'right'
    to.scrollTop = from.scrollTop
    requestAnimationFrame(() => {
      syncingRef.current = null
    })
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid shrink-0 grid-cols-2 border-b border-border text-xs font-medium text-text-secondary">
        <div className="border-r border-border px-3 py-1.5">{oldLabel}</div>
        <div className="px-3 py-1.5">{newLabel}</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <div
          ref={leftRef}
          onScroll={handleLeftScroll}
          className="min-h-0 overflow-auto border-r border-border"
        >
          {blocks.map((block) => (
            <BlockRows
              key={block.key}
              block={block}
              side="left"
              expanded={expanded.has(block.key)}
              onExpand={() => setExpanded((s) => new Set(s).add(block.key))}
            />
          ))}
        </div>
        <div ref={rightRef} onScroll={handleRightScroll} className="min-h-0 overflow-auto">
          {blocks.map((block) => (
            <BlockRows
              key={block.key}
              block={block}
              side="right"
              expanded={expanded.has(block.key)}
              onExpand={() => setExpanded((s) => new Set(s).add(block.key))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
