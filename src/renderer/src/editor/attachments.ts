import type { EditorView } from '@codemirror/view'

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function timestampFileName(mimeType: string): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const ext = MIME_EXTENSIONS[mimeType] ?? 'png'
  return `붙여넣기 ${stamp}.${ext}`
}

export async function insertAttachments(
  files: File[],
  view: EditorView,
  noteDirPath: string,
  useTimestampName: boolean
): Promise<void> {
  if (files.length === 0 || !noteDirPath) return

  const pos = view.state.selection.main.head
  const parts: string[] = []

  for (const file of files) {
    const isImage = file.type.startsWith('image/')
    const kind: 'img' | 'files' = isImage ? 'img' : 'files'
    const fileName =
      useTimestampName && isImage
        ? timestampFileName(file.type)
        : file.name || timestampFileName(file.type)
    const buffer = await file.arrayBuffer()
    const relativePath = await window.api.workspace.saveAttachment(
      noteDirPath,
      kind,
      fileName,
      buffer
    )
    const savedName = relativePath.split('/').pop() ?? relativePath
    // 이미지는 앱 안에서 `![[ ]]` 하나로 통일하고, md로 내보낼 때만 표준 문법으로 바꾼다
    parts.push(isImage ? `![[${relativePath}]]` : `[${savedName}](<${relativePath}>)`)
  }

  const insertText = parts.join(' ')
  view.dispatch({
    changes: { from: pos, to: pos, insert: insertText },
    selection: { anchor: pos + insertText.length }
  })
}
