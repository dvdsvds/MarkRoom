import { readFileSync, statSync } from 'fs'

interface CachedNote {
  mtimeMs: number
  size: number
  content: string
}

const MAX_CACHED_BYTES = 1024 * 1024
const cache = new Map<string, CachedNote>()

export function readNoteCached(filePath: string): string {
  const st = statSync(filePath)
  const hit = cache.get(filePath)
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.content
  const content = readFileSync(filePath, 'utf-8')
  if (st.size <= MAX_CACHED_BYTES) cache.set(filePath, { mtimeMs: st.mtimeMs, size: st.size, content })
  else cache.delete(filePath)
  return content
}

export function invalidateNote(filePath: string): void {
  cache.delete(filePath)
}
