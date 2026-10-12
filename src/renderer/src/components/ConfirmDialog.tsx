import { useEffect } from 'react'
import TrashIcon from '../icons/ctx-trash.svg?react'
import UndoIcon from '../icons/tb-undo.svg?react'
import { FileTypeIcon } from './FileTypeIcon'
import {
  CancelButton,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  ListBox,
  MainButton,
  NameBox
} from './DialogParts'

interface ConfirmDialogProps {
  title: string
  /** 대상 파일이나 폴더. 주면 이름 박스로 크게 보여준다. */
  subject?: { name: string; kind: 'file' | 'folder' }
  message: string
  items?: string[]
  confirmLabel: string
  danger?: boolean
  icon?: 'trash' | 'reset'
  onConfirm: () => void
  onCancel: () => void
}

/** 삭제처럼 되돌리기 어려운 작업 전에 확인받는 가운데 모달. */
export function ConfirmDialog({
  title,
  subject,
  message,
  items,
  confirmLabel,
  danger,
  icon = 'trash',
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onConfirm])

  const Icon = icon === 'reset' ? UndoIcon : TrashIcon

  return (
    <Dialog width={380} onClose={onCancel}>
      <DialogHeader icon={<Icon width={18} height={18} />} title={title} danger={danger} />
      <DialogBody>
        {subject && (
          <NameBox>
            <FileTypeIcon name={subject.name} kind={subject.kind} size={20} />
            <span className="min-w-0 truncate text-sm font-medium text-text">{subject.name}</span>
          </NameBox>
        )}
        <div className={`text-[13px] leading-relaxed text-text-secondary ${subject ? 'mt-3' : ''}`}>
          {/* 마침표 뒤에 공백이 있으면 거기서 줄을 바꾼다 ("test.md"처럼 공백 없는 점은 그대로) */}
          {message.split(/(?<=\.)\s+/).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        {items && items.length > 0 && <ListBox items={items} />}
      </DialogBody>
      <DialogFooter>
        <CancelButton onClick={onCancel} />
        <MainButton onClick={onConfirm} danger={danger}>
          {confirmLabel}
        </MainButton>
      </DialogFooter>
    </Dialog>
  )
}
