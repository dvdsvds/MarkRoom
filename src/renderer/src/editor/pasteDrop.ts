import { type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { insertAttachments } from './attachments'

export function pasteDrop(getAttachmentDir: () => string): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length === 0) return false
      event.preventDefault()
      void insertAttachments(files, view, getAttachmentDir(), true)
      return true
    },
    drop(event, view) {
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length === 0) return false
      event.preventDefault()
      void insertAttachments(files, view, getAttachmentDir(), false)
      return true
    }
  })
}