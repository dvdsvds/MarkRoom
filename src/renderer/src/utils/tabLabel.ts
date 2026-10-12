import type { Tab } from '../stores/tabsStore'
import { fileNameOf } from './path'

export function tabLabel(tab: Tab): string {
  if (tab.filePath) {
    const fileName = fileNameOf(tab.filePath)
    return fileName.replace(/\.md$/, '')
  }
  const firstLine = tab.content.split('\n', 1)[0]?.replace(/^#\s*/, '').trim()
  return firstLine && firstLine.length > 0 ? firstLine : '제목 없음'
}
