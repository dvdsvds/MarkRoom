import { basename, dirname, extname, join, relative, resolve, sep } from 'path'
import { walkMdFiles } from './links'
import { readFileSync, readdirSync, statSync } from 'fs'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import { frontMatterFor } from './noteProps'

const WIKILINK_RE = /\[\[\s*([^[\]\n]+?)\s*\]\]/g

/** `노트#제목|별칭`을 나눈다. `[[#제목]]`이면 note가 빈 문자열 */
function parseWikilink(inner: string): { note: string; heading: string | null; label: string } {
  const bar = inner.indexOf('|')
  const target = bar === -1 ? inner : inner.slice(0, bar)
  const alias = bar === -1 ? '' : inner.slice(bar + 1).trim()
  const hash = target.indexOf('#')
  const note = (hash === -1 ? target : target.slice(0, hash)).trim()
  const heading = hash === -1 ? null : target.slice(hash + 1).trim() || null
  const label = alias || (heading ? (note ? `${note} > ${heading}` : heading) : note)
  return { note, heading, label }
}

/** GitHub 방식 제목 앵커 */
function headingSlug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}
const EMBED_RE = /!\[\[\s*([^[\]\n]+?)\s*\]\]/g
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i

/** `![[ ]]`·`[[ ]]` 대상이 노트가 아니라 파일(확장자가 있고 .md가 아님)인지 */
function isFileTarget(target: string): boolean {
  return /\.[A-Za-z0-9]{1,8}$/.test(target) && !/\.(md|markdown)$/i.test(target)
}

function walkAllFiles(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name.startsWith('.')) continue
    const p = join(dir, name)
    try {
      if (statSync(p).isDirectory()) walkAllFiles(p, out)
      else out.push(p)
    } catch {
      continue
    }
  }
  return out
}

/** 노트 기준 상대 경로가 맞으면 그것을, 아니면 작업 폴더에서 같은 이름 파일(가까운 것 우선)을 찾는다 */
function resolveEmbedAsset(
  target: string,
  noteDir: string,
  rootDir: string,
  allFiles: () => string[]
): string | null {
  const root = resolve(rootDir) + sep
  const direct = resolve(noteDir, target)
  if (direct.startsWith(root) && isFile(direct)) return direct
  const name = basename(target).toLowerCase()
  const candidates = allFiles().filter((f) => basename(f).toLowerCase() === name)
  if (candidates.length === 0) return null
  const rank = (f: string): number => {
    const d = dirname(f)
    if (d === join(noteDir, 'img') || d === join(noteDir, 'files')) return 0
    if (d === noteDir) return 1
    return d.startsWith(noteDir + sep) ? 2 : 3
  }
  return [...candidates].sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0]
}

const IMG_RE = /!\[([^\]]*)\]\((<[^>]+>|[^)\s]+)\)/g
const LINK_RE = /(?<!!)\[([^\]]*)\]\((<[^>]+>|[^)\s]+)\)/g
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i
const FILES_RE = /^(\.\/)?files\//

function toPosix(p: string): string {
  return p.split(sep).join('/')
}

function wrapHref(p: string): string {
  return p.includes(' ') ? `<${p}>` : p
}

function stripAngle(raw: string): string {
  return raw.startsWith('<') ? raw.slice(1, -1) : raw
}

function decodeSafe(s: string): string {
  try {
    return decodeURI(s)
  } catch {
    return s
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

function swapPdf(p: string): string {
  return p.slice(0, p.length - extname(p).length) + '.pdf'
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
  /** 링크가 처음 나오는 줄 (1부터) */
  line: number
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
    const seen = new Set<string>()
    let line = 1
    let pos = 0
    WIKILINK_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = WIKILINK_RE.exec(raw)) !== null) {
      const title = parseWikilink(match[1]).note
      if (!title || isFileTarget(title) || seen.has(title)) continue
      seen.add(title)
      for (; pos < match.index; pos++) if (raw.charCodeAt(pos) === 10) line++
      const target = titleIndex.get(title)
      if (!target) {
        broken.push({ fromPath: filePath, title, reason: 'missing', line })
      } else if (target !== filePath && !target.startsWith(folderPrefix)) {
        broken.push({ fromPath: filePath, title, reason: 'outside', line })
      }
    }
  }
  return broken
}

export interface ExportOptions {
  folderPath: string
  /** MD 결과물이 들어갈 폴더 (export-md) */
  destDir: string
  isRoot: boolean
  representativeName: 'README' | 'index' | 'main' | null
}

export interface ExportResult {
  exportedFiles: number
  images: number
  attachments: number
}

function destRelFor(absPath: string, opts: ExportOptions): string {
  const rel = relative(opts.folderPath, absPath)
  if (opts.isRoot && opts.representativeName && rel === 'main.md') {
    return `${opts.representativeName}.md`
  }
  return rel
}

interface Collector {
  destDir: string
  folder: 'imgs' | 'files'
  used: Set<string>
  byAbs: Map<string, string>
  jobs: { from: string; to: string }[]
}

function newCollector(destDir: string, folder: 'imgs' | 'files'): Collector {
  return { destDir, folder, used: new Set(), byAbs: new Map(), jobs: [] }
}

function collect(c: Collector, abs: string): string {
  const hit = c.byAbs.get(abs)
  if (hit) return hit
  const ext = extname(abs)
  const stem = basename(abs, ext)
  let name = basename(abs)
  let n = 2
  while (c.used.has(name.toLowerCase())) {
    name = `${stem} ${n}${ext}`
    n += 1
  }
  c.used.add(name.toLowerCase())
  c.byAbs.set(abs, name)
  c.jobs.push({ from: abs, to: join(c.destDir, c.folder, name) })
  return name
}

function rewriteAsset(
  rawTarget: string,
  noteDir: string,
  rootDir: string,
  c: Collector,
  fromDir: string
): string | null {
  const raw = stripAngle(rawTarget)
  if (SCHEME_RE.test(raw) || raw.startsWith('/') || raw.startsWith('#')) return null
  let abs = resolve(noteDir, raw)
  if (!isFile(abs)) {
    abs = resolve(noteDir, decodeSafe(raw))
    if (!isFile(abs)) return null
  }
  if (!abs.startsWith(resolve(rootDir) + sep)) return null
  const name = collect(c, abs)
  return wrapHref(toPosix(relative(fromDir, join(c.destDir, c.folder, name))))
}

export async function exportFolder(rootDir: string, opts: ExportOptions): Promise<ExportResult> {
  const titleIndex = buildTitleIndex(rootDir)
  const folderPrefix = opts.folderPath + sep
  const imgs = newCollector(opts.destDir, 'imgs')
  const files = newCollector(opts.destDir, 'files')
  const writes: { to: string; text: string }[] = []
  let allFilesCache: string[] | null = null
  const allFiles = (): string[] => (allFilesCache ??= walkAllFiles(rootDir))

  for (const filePath of walkMdFiles(opts.folderPath)) {
    const destPath = join(opts.destDir, destRelFor(filePath, opts))
    const destDirPath = dirname(destPath)
    const noteDir = dirname(filePath)

    let text = readFileSync(filePath, 'utf-8')

    text = text.replace(IMG_RE, (whole: string, alt: string, target: string) => {
      const href = rewriteAsset(target, noteDir, rootDir, imgs, destDirPath)
      return href ? `![${alt}](${href})` : whole
    })

    text = text.replace(LINK_RE, (whole: string, label: string, target: string) => {
      if (!FILES_RE.test(stripAngle(target))) return whole
      const href = rewriteAsset(target, noteDir, rootDir, files, destDirPath)
      return href ? `[${label}](${href})` : whole
    })

    // 앱 안의 `![[ ]]`를 표준 마크다운으로 바꾼다. 노트 임베드는 링크로 둔다.
    text = text.replace(EMBED_RE, (_whole: string, inner: string) => {
      const target = inner.split('|')[0].split('#')[0].trim()
      if (!isFileTarget(target)) return `[[${inner}]]`
      const abs = resolveEmbedAsset(target, noteDir, rootDir, allFiles)
      if (!abs) return target
      const isImage = IMAGE_EXT_RE.test(abs)
      const c = isImage ? imgs : files
      const href = wrapHref(
        toPosix(relative(destDirPath, join(c.destDir, c.folder, collect(c, abs))))
      )
      return isImage ? `![](${href})` : `[${basename(abs)}](${href})`
    })

    text = text.replace(WIKILINK_RE, (_whole: string, inner: string) => {
      const { note, heading, label } = parseWikilink(inner)
      const anchor = heading ? `#${headingSlug(heading)}` : ''
      if (!note) return anchor ? `[${label}](${anchor})` : label
      const target = titleIndex.get(note)
      if (!target) return label
      const insideFolder = target === filePath || target.startsWith(folderPrefix)
      if (!insideFolder) return label
      const destTargetPath = join(opts.destDir, destRelFor(target, opts))
      const linkPath = toPosix(relative(destDirPath, destTargetPath))
      return `[${label}](${wrapHref(linkPath + anchor)})`
    })

    writes.push({ to: destPath, text: frontMatterFor(filePath) + text })
  }

  for (const w of writes) {
    await mkdir(dirname(w.to), { recursive: true })
    await writeFile(w.to, w.text, 'utf-8')
  }
  for (const c of [imgs, files]) {
    for (const j of c.jobs) {
      await mkdir(dirname(j.to), { recursive: true })
      await copyFile(j.from, j.to)
    }
  }

  return { exportedFiles: writes.length, images: imgs.byAbs.size, attachments: files.byAbs.size }
}

export interface PdfNote {
  relPath: string
  source: string
  baseDir: string
  links: Record<string, string | null>
}

export function listPdfNotes(rootDir: string, folderPath: string): PdfNote[] {
  const titleIndex = buildTitleIndex(rootDir)
  const folderPrefix = folderPath + sep
  const notes: PdfNote[] = []

  for (const filePath of walkMdFiles(folderPath)) {
    let source: string
    try {
      source = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }
    const links: Record<string, string | null> = {}
    for (const m of source.matchAll(WIKILINK_RE)) {
      const title = parseWikilink(m[1]).note
      if (!title || isFileTarget(title) || Object.prototype.hasOwnProperty.call(links, title))
        continue
      const target = titleIndex.get(title)
      const inside = target && (target === filePath || target.startsWith(folderPrefix))
      links[title] = inside
        ? encodeURI(toPosix(relative(dirname(filePath), swapPdf(target))))
        : null
    }
    notes.push({
      relPath: toPosix(swapPdf(relative(folderPath, filePath))),
      source,
      baseDir: dirname(filePath),
      links
    })
  }
  return notes
}
