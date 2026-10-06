import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, join, relative, sep } from 'path'
import { walkMdFiles } from './links'

const WIKILINK_RE = /\[\[\s*([^[\]\n]+?)\s*\]\]/g

function walkAllFiles(dir: string): string[] {
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
      results.push(...walkAllFiles(fullPath))
    } else if (stat.isFile()) {
      results.push(fullPath)
    }
  }
  return results
}

function buildTitleIndex(rootDir: string): Map<string, string> {
  const index = new Map<string, string>()
  for (const filePath of walkMdFiles(rootDir)) {
    index.set(basename(filePath, extname(filePath)), filePath)
  }
  return index
}

export interface BrokenLink {
  fromPath: string
  title: string
  reason: 'missing' | 'outside'
}

export function checkExportLinks(rootDir: string, folderPath: string): BrokenLink[] {
  const titleIndex = buildTitleIndex(rootDir)
  const folderPrefix = folderPath + sep
  const broken: BrokenLink[] = []

  for (const filePath of walkMdFiles(folderPath)) {
    let raw: string
    try {
      raw = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }
    const body = raw
    const seen = new Set<string>()
    WIKILINK_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKILINK_RE.exec(body)) !== null) {
      const title = match[1]
      if (seen.has(title)) continue
      seen.add(title)
      const target = titleIndex.get(title)
      if (!target) {
        broken.push({ fromPath: filePath, title, reason: 'missing' })
      } else if (target !== filePath && !target.startsWith(folderPrefix)) {
        broken.push({ fromPath: filePath, title, reason: 'outside' })
      }
    }
  }
  return broken
}

export interface ExportOptions {
  folderPath: string
  destDir: string
  isRoot: boolean
  /** 루트 export이고 루트에 main.md가 있을 때만 의미가 있다. */
  representativeName: 'README' | 'index' | 'main' | null
}

export interface ExportResult {
  exportedFiles: number
}

/** 대상 파일이 내보내지는 파일 트리에서 어떤 상대 경로로 나가는지 계산한다.
 * 루트의 main.md만 대표 문서 이름으로 바뀐다 (기획 문서 7장). */
function destRelFor(absPath: string, opts: ExportOptions): string {
  const rel = relative(opts.folderPath, absPath)
  if (opts.isRoot && opts.representativeName && rel === 'main.md') {
    return `${opts.representativeName}.md`
  }
  return rel
}

/**
 * 폴더 하나를 destDir로 내보낸다. 위키링크는 표준 마크다운 링크로 바꾸고,
 * img/files 폴더는 그대로 복사한다 (기획 문서 7장).
 */
export function exportFolder(rootDir: string, opts: ExportOptions): ExportResult {
  const titleIndex = buildTitleIndex(rootDir)
  const folderPrefix = opts.folderPath + sep
  let exportedFiles = 0

  for (const filePath of walkAllFiles(opts.folderPath)) {
    const destRelPath = destRelFor(filePath, opts)
    const destPath = join(opts.destDir, destRelPath)
    const destDirPath = dirname(destPath)
    if (!existsSync(destDirPath)) mkdirSync(destDirPath, { recursive: true })

    if (extname(filePath).toLowerCase() === '.md') {
      const raw = readFileSync(filePath, 'utf-8')
      const body = raw
      const converted = body.replace(WIKILINK_RE, (whole: string, rawTitle: string) => {
        const title = rawTitle.trim()
        const target = titleIndex.get(title)
        if (!target) return whole
        const insideFolder = target === filePath || target.startsWith(folderPrefix)
        if (!insideFolder) return whole
        const destTargetRel = destRelFor(target, opts)
        const destTargetPath = join(opts.destDir, destTargetRel)
        const linkPath = relative(destDirPath, destTargetPath).split(sep).join('/')
        const href = linkPath.includes(' ') ? `<${linkPath}>` : linkPath
        return `[${title}](${href})`
      })
      writeFileSync(destPath, converted, 'utf-8')
    } else {
      copyFileSync(filePath, destPath)
    }
    exportedFiles += 1
  }

  return { exportedFiles }
}
