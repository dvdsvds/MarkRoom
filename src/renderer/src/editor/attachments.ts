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

/** 클립보드 이미지 붙여넣기용 "붙여넣은 시각" 이름 (기획 문서 5장). */
function timestampFileName(mimeType: string): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  const ext = MIME_EXTENSIONS[mimeType] ?? 'png'
  return `붙여넣기 ${stamp}.${ext}`
}

/**
 * 붙여넣기/드래그로 들어온 파일들을 메모 폴더의 img·files 하위 폴더에 저장하고
 * 커서 위치에 마크다운 링크를 삽입한다 (기획 문서 5장).
 *
 * useTimestampName이 true면(클립보드 붙여넣기) 이미지 이름을 시각 이름으로
 * 바꾸고, false면(드래그 앤 드롭) 원본 이름을 그대로 쓴다.
 */
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
    parts.push(isImage ? `![](<${relativePath}>)` : `[${savedName}](<${relativePath}>)`)
  }

  const insertText = parts.join(' ')
  view.dispatch({
    changes: { from: pos, to: pos, insert: insertText },
    selection: { anchor: pos + insertText.length }
  })
}
