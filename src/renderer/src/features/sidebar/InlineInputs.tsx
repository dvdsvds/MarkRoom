import { useState } from 'react'
import { FileTypeIcon } from '../../components/FileTypeIcon'
import { newFileNameFor } from '@renderer/utils/path'

export function InlineNameInput({
  initialValue,
  onCommit,
  onCancel,
  onValueChange,
  paddingLeft,
  inline = false,
  medium = false
}: {
  initialValue: string
  onCommit: (value: string) => void
  onCancel: () => void
  onValueChange?: (value: string) => void
  paddingLeft: number
  inline?: boolean
  medium?: boolean
}): React.JSX.Element {
  const [value, setValue] = useState(initialValue)
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => {
        setValue(e.target.value)
        onValueChange?.(e.target.value)
      }}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const trimmed = value.trim()
          if (trimmed.length > 0) onCommit(trimmed)
          else onCancel()
        } else if (e.key === 'Escape') {
          onCancel()
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className={
        inline
          ? `-ml-[5px] h-6 min-w-0 flex-1 rounded border border-accent bg-bg px-1 text-[13px] text-text outline-none${medium ? ' font-medium' : ''}`
          : 'my-0.5 w-[calc(100%-8px)] rounded border border-accent bg-bg px-1.5 py-0.5 text-sm text-text outline-none'
      }
      style={inline ? undefined : { marginLeft: paddingLeft }}
    />
  )
}

export function NewFileRow({
  paddingLeft,
  onCommit,
  onCancel
}: {
  paddingLeft: number
  onCommit: (value: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [typed, setTyped] = useState('')
  return (
    <div className="flex h-7 w-full items-center gap-2 pr-2" style={{ paddingLeft }}>
      <FileTypeIcon name={newFileNameFor(typed)} kind="file" />
      <InlineNameInput
        initialValue=""
        onValueChange={setTyped}
        onCommit={onCommit}
        onCancel={onCancel}
        paddingLeft={0}
        inline
      />
    </div>
  )
}