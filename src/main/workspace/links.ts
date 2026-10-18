import { readdirSync, statSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { readNoteCached } from './noteCache'

export function walkMdFiles(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const results: string[] = []
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      results.push(...walkMdFiles(fullPath))
    } else if (stat.isFile() && extname(entry).toLowerCase() === '.md') {
      results.push(fullPath)
    }
  }
  return results
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// `[[노트]]`, `[[노트#제목]]`, `[[노트|별칭]]`을 모두 잡는다. 1번 그룹은 `#제목|별칭` 부분
function wikilinkPattern(title: string): RegExp {
  return new RegExp(
    `\\[\\[\\s*${escapeRegExp(title)}\\s*((?:#[^\\]|\\n]*)?(?:\\|[^\\]\\n]*)?)\\]\\]`,
    'g'
  )
}

/** `[[ ]]` 안쪽에서 노트 이름만 꺼낸다. `[[#제목]]`이면 빈 문자열 */
function linkTargetNote(inner: string): string {
  return inner.split(/[#|]/)[0].trim()
}

export interface Backlink {
  path: string
  count: number
}

export function findBacklinks(rootDir: string, title: string, excludePath?: string): Backlink[] {
  const pattern = wikilinkPattern(title)
  const results: Backlink[] = []
  for (const filePath of walkMdFiles(rootDir)) {
    if (filePath === excludePath) continue
    let content: string
    try {
      content = readNoteCached(filePath)
    } catch {
      continue
    }
    const matches = content.match(pattern)
    if (matches && matches.length > 0) {
      results.push({ path: filePath, count: matches.length })
    }
  }
  return results
}

export interface BacklinkContext {
  line: number
  text: string
}

export interface BacklinkWithContext extends Backlink {
  contexts: BacklinkContext[]
}

const MAX_CONTEXTS_PER_FILE = 10

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 60)
  const end = Math.min(text.length, index + length + 80)
  const body = text.slice(start, end).trim()
  return (start > 0 ? '…' : '') + body + (end < text.length ? '…' : '')
}

export function findBacklinkContexts(
  rootDir: string,
  title: string,
  excludePath?: string
): BacklinkWithContext[] {
  const pattern = wikilinkPattern(title)
  const results: BacklinkWithContext[] = []
  for (const filePath of walkMdFiles(rootDir)) {
    if (filePath === excludePath) continue
    let content: string
    try {
      content = readNoteCached(filePath)
    } catch {
      continue
    }
    const lines = content.split(/\r?\n/)
    const contexts: BacklinkContext[] = []
    let count = 0
    for (let i = 0; i < lines.length; i++) {
      pattern.lastIndex = 0
      const first = pattern.exec(lines[i])
      if (!first) continue
      count += 1
      while (pattern.exec(lines[i]) !== null) count += 1
      if (contexts.length < MAX_CONTEXTS_PER_FILE) {
        contexts.push({ line: i + 1, text: snippetAround(lines[i], first.index, first[0].length) })
      }
    }
    if (count > 0) results.push({ path: filePath, count, contexts })
  }
  return results
}

export function updateWikilinksOnRename(
  rootDir: string,
  oldTitle: string,
  newTitle: string,
  beforeWrite?: (filePath: string, before: string) => void
): string[] {
  if (oldTitle === newTitle) return []
  const pattern = wikilinkPattern(oldTitle)
  const changed: string[] = []
  for (const filePath of walkMdFiles(rootDir)) {
    let content: string
    try {
      content = readNoteCached(filePath)
    } catch {
      continue
    }
    if (!pattern.test(content)) continue
    pattern.lastIndex = 0
    const updated = content.replace(pattern, (_m, rest: string) => `[[${newTitle}${rest}]]`)
    if (updated !== content) {
      beforeWrite?.(filePath, content)
      writeFileSync(filePath, updated, 'utf-8')
      changed.push(filePath)
    }
  }
  return changed
}

export interface LinkGraph {
  nodes: { path: string; title: string }[]
  edges: { source: string; target: string }[]
}

const WIKILINK_RE = /\[\[([^[\n]+?)\]\]/g

export function buildLinkGraph(rootDir: string): LinkGraph {
  const files = walkMdFiles(rootDir)
  const byTitle = new Map<string, string>()
  for (const filePath of files) {
    const title = basename(filePath, extname(filePath))
    if (!byTitle.has(title)) byTitle.set(title, filePath)
  }
  const edges: LinkGraph['edges'] = []
  const seen = new Set<string>()
  for (const filePath of files) {
    let content: string
    try {
      content = readNoteCached(filePath)
    } catch {
      continue
    }
    for (const m of content.matchAll(WIKILINK_RE)) {
      const target = byTitle.get(linkTargetNote(m[1]))
      if (!target || target === filePath) continue
      const key = `${filePath}\0${target}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ source: filePath, target })
    }
  }
  return {
    nodes: files.map((filePath) => ({
      path: filePath,
      title: basename(filePath, extname(filePath))
    })),
    edges
  }
}