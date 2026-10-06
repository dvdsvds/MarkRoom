import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { dirname, join } from 'path'
import { assertInsideRoot } from './paths'

export interface RecoverableItem {
  tmpPath: string
  targetPath: string
  tmpContent: string
  currentContent: string | null
}

function walkForTmp(dir: string, results: RecoverableItem[]): void {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      if (entry.startsWith('.')) continue
      walkForTmp(fullPath, results)
      continue
    }
    if (!stat.isFile() || !entry.startsWith('.') || !entry.endsWith('.tmp')) continue

    const targetName = entry.slice(1, -'.tmp'.length)
    if (targetName.length === 0) continue
    const targetPath = join(dir, targetName)

    let tmpContent: string
    try {
      tmpContent = readFileSync(fullPath, 'utf-8')
    } catch {
      continue
    }
    const currentContent = existsSync(targetPath) ? readFileSync(targetPath, 'utf-8') : null
    results.push({ tmpPath: fullPath, targetPath, tmpContent, currentContent })
  }
}

export function findRecoverableFiles(rootDir: string): RecoverableItem[] {
  const results: RecoverableItem[] = []
  walkForTmp(rootDir, results)
  return results
}

export function applyRecovery(tmpPath: string, targetPath: string): void {
  const safeTmp = assertInsideRoot(tmpPath)
  const safeTarget = assertInsideRoot(targetPath)
  const content = readFileSync(safeTmp, 'utf-8')
  const dir = dirname(safeTarget)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(safeTarget, content, 'utf-8')
  unlinkSync(safeTmp)
}

export function discardRecovery(tmpPath: string): void {
  const safeTmp = assertInsideRoot(tmpPath)
  unlinkSync(safeTmp)
}
