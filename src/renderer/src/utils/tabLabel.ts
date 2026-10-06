import type { Tab } from '../stores/tabsStore'

/** 탭에 보여줄 이름. 저장된 파일이면 파일 이름, 아니면 본문 첫 줄(제목). */
export function tabLabel(tab: Tab): string {
  if (tab.filePath) {
    const fileName = tab.filePath.split(/[/\\]/).pop() ?? tab.filePath
    return fileName.replace(/\.md$/, '')
  }
  const firstLine = tab.content.split('\n', 1)[0]?.replace(/^#\s*/, '').trim()
  return firstLine && firstLine.length > 0 ? firstLine : '제목 없음'
}
