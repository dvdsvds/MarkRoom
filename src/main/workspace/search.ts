import { readFileSync } from 'fs'
import { basename, extname } from 'path'
import { walkMdFiles } from './links'

function safeRead(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

export interface SearchQuery {
  text: string
  folder: string | null
}

export interface SearchResult {
  path: string
  title: string
  snippet: string | null
}

const MAX_RESULTS = 100

export function searchNotes(rootDir: string, query: SearchQuery): SearchResult[] {
  const results: SearchResult[] = []
  const lowerText = query.text.trim().toLowerCase()

  for (const filePath of walkMdFiles(rootDir)) {
    if (query.folder && !filePath.startsWith(`${query.folder}/`)) continue

    const raw = safeRead(filePath)
    if (raw === null) continue
    const body = raw

    const title = basename(filePath, extname(filePath))

    if (lowerText.length === 0) {
      results.push({ path: filePath, title, snippet: null })
      continue
    }

    if (title.toLowerCase().includes(lowerText)) {
      results.push({ path: filePath, title, snippet: null })
      continue
    }

    const bodyLower = body.toLowerCase()
    const idx = bodyLower.indexOf(lowerText)
    if (idx !== -1) {
      const start = Math.max(0, idx - 30)
      const end = Math.min(body.length, idx + lowerText.length + 30)
      const snippet =
        (start > 0 ? '…' : '') +
        body.slice(start, end).replace(/\s+/g, ' ') +
        (end < body.length ? '…' : '')
      results.push({ path: filePath, title, snippet })
    }

    if (results.length >= MAX_RESULTS) break
  }

  return results
}
