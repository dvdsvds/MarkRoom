import { useSettingsStore } from '../stores/settingsStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { flattenFilePaths } from './noteIndex'
import { dirOf, fileNameOf, sepOf, splitName } from './path'
import { parseDate, formatDate } from './dateFormat'
import { DAILY_TEMPLATE_ID, applyTemplate } from './noteTemplate'

const FALLBACK_DAILY_TEMPLATE = '# {{title}}\n\n'

function joinPath(base: string, ...parts: string[]): string {
  const sep = sepOf(base)
  return [base.replace(/[\\/]+$/, ''), ...parts.filter(Boolean)].join(sep)
}

export function dailyFolderPath(): string | null {
  const root = useWorkspaceStore.getState().rootDir
  if (!root) return null
  return joinPath(root, ...useSettingsStore.getState().dailyFolder.split(/[\\/]/))
}

export function dailyNotePath(date: Date): string | null {
  const dir = dailyFolderPath()
  if (!dir) return null
  return joinPath(dir, `${formatDate(date, useSettingsStore.getState().dailyFormat)}.md`)
}

/** 데일리 폴더 안에서 이름이 날짜 형식과 맞는 노트면 그 날짜 */
export function dailyNoteDate(filePath: string): Date | null {
  const dir = dailyFolderPath()
  if (!dir || dirOf(filePath).toLowerCase() !== dir.toLowerCase()) return null
  const { base, ext } = splitName(fileNameOf(filePath))
  if (ext.toLowerCase() !== '.md') return null
  return parseDate(base, useSettingsStore.getState().dailyFormat)
}

/** 데일리 노트 전체를 날짜순으로 */
export function listDailyNotes(): { path: string; date: Date }[] {
  const out: { path: string; date: Date }[] = []
  for (const path of flattenFilePaths(useWorkspaceStore.getState().tree)) {
    const date = dailyNoteDate(path)
    if (date) out.push({ path, date })
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/** 데일리 노트 내용을 만든다. 사이드바 템플릿의 `데일리`를 쓴다 */
export function buildDailyContent(date: Date, title: string): string {
  const { templates, dailyFormat } = useSettingsStore.getState()
  const template = templates.find((t) => t.id === DAILY_TEMPLATE_ID)?.content
  return applyTemplate(template ?? FALLBACK_DAILY_TEMPLATE, {
    date,
    title,
    dateFormat: dailyFormat
  })
}
