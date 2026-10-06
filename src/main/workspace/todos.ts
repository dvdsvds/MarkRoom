import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

export interface TodoItem {
  path: string
  line: number
  text: string
  done: boolean
}

const TASK_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]\s+(.*)$/
const FENCE_RE = /^\s*(```|~~~)/
const SKIP_DIRS = new Set(['node_modules', '.git', '.trash'])

function walk(dir: string, out: string[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(full)
  }
}

export function scanTodos(rootDir: string, overrides: Record<string, string> = {}): TodoItem[] {
  const norm = (p: string): string => p.replace(/\\/g, '/')
  const ov = new Map(Object.entries(overrides).map(([p, c]) => [norm(p), c]))
  const files: string[] = []
  walk(rootDir, files)
  const items: TodoItem[] = []
  for (const path of files) {
    let content: string
    const overridden = ov.get(norm(path))
    if (overridden !== undefined) {
      content = overridden
    } else {
      try {
        content = readFileSync(path, 'utf-8')
      } catch {
        continue
      }
    }
    const lines = content.split(/\r?\n/)
    let fence: string | null = null
    for (let i = 0; i < lines.length; i++) {
      const f = FENCE_RE.exec(lines[i])
      if (f) {
        if (fence === null) fence = f[1]
        else if (fence === f[1]) fence = null
        continue
      }
      if (fence) continue
      const m = TASK_RE.exec(lines[i])
      if (m) items.push({ path, line: i + 1, text: m[2].trim(), done: m[1] !== ' ' })
    }
  }
  return items
}