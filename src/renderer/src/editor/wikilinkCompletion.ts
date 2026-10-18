import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { flattenFilePaths, type NoteRef } from '../utils/noteIndex'
import { headingsOf } from '../utils/wikilink'
import { isImageTarget, isNoteTarget, relativePath } from '../utils/embed'
import { dirOf, fileNameOf } from '../utils/path'
import { useTabsStore } from '../stores/tabsStore'
import { useWorkspaceStore } from '../stores/workspaceStore'

async function noteContent(note: NoteRef): Promise<string | null> {
  const tab = useTabsStore.getState().tabs.find((t) => t.filePath === note.path)
  if (tab) return tab.content
  try {
    return await window.api.workspace.readFile(note.path)
  } catch {
    return null
  }
}

/** `![[` 뒤에서 추천할 노트가 아닌 파일들. 지금 노트 기준 상대 경로로 넣는다 */
function fileOptions(query: string): Completion[] {
  const tabs = useTabsStore.getState()
  const current = tabs.tabs.find((t) => t.id === tabs.activeTabId)?.filePath
  if (!current) return []
  const noteDir = dirOf(current)
  return flattenFilePaths(useWorkspaceStore.getState().tree)
    .filter((p) => !isNoteTarget(p) && fileNameOf(p).toLowerCase().includes(query))
    .sort((a, b) => Number(isImageTarget(b)) - Number(isImageTarget(a)))
    .slice(0, 20)
    .map((p) => {
      const rel = relativePath(noteDir, p)
      return { label: fileNameOf(p), detail: rel, type: 'variable', apply: rel }
    })
}

export function wikilinkCompletionSource(getNotes: () => NoteRef[]) {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const match = context.matchBefore(/!?\[\[[^\]\n]*/)
    if (!match) return null
    const isEmbed = match.text.startsWith('!')
    const start = match.from + (isEmbed ? 3 : 2)

    const inner = match.text.slice(isEmbed ? 3 : 2)
    // 별칭(`|` 뒤)은 사용자가 직접 쓰는 글자라 추천하지 않는다
    if (inner.includes('|')) return null

    const hash = inner.indexOf('#')
    if (hash === -1) {
      const query = inner.toLowerCase()
      const notes: Completion[] = getNotes()
        .filter((n) => n.title.toLowerCase().includes(query))
        .slice(0, 20)
        .map((n) => ({ label: n.title, type: 'text', apply: n.title }))
      // 임베드면 이미지·첨부 파일도 같이 추천한다
      const options = isEmbed ? [...fileOptions(query), ...notes] : notes
      if (options.length === 0 && query.length === 0) return null
      // `#`나 `|`를 치면 다시 계산해서 제목 추천으로 넘어가게 한다
      return { from: start, options, validFor: /^[^\]|#\n]*$/ }
    }

    // `[[노트#` → 그 노트의 제목, `[[#` → 지금 노트의 제목
    const noteTitle = inner.slice(0, hash).trim()
    let content: string | null
    if (!noteTitle) {
      content = context.state.doc.toString()
    } else {
      const note = getNotes().find((n) => n.title === noteTitle)
      content = note ? await noteContent(note) : null
    }
    if (content === null) return null
    const query = inner.slice(hash + 1).toLowerCase()
    const options = headingsOf(content)
      .filter((h) => h.text.toLowerCase().includes(query))
      .slice(0, 30)
      // 편집기가 점수가 같은 항목을 다시 정렬하지 않도록 문서 순서대로 가중치를 준다
      .map((h, i) => ({ label: h.text, type: 'text', apply: h.text, boost: 99 - i }))
    if (options.length === 0) return null
    return { from: start + hash + 1, options, validFor: /^[^\]|#\n]*$/ }
  }
}
