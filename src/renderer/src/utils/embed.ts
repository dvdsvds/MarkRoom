import { dirOf, fileNameOf, sepOf } from './path'

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i
const NOTE_EXT_RE = /\.(md|markdown)$/i
const HAS_EXT_RE = /\.[A-Za-z0-9]{1,8}$/

export interface EmbedParts {
  /** `회의록`, `img/그림.png` 처럼 `#`·`|` 앞부분 */
  target: string
  heading: string | null
  alias: string | null
  /** `![[그림.png|300]]` 의 300 */
  width: number | null
}

/** `![[ ]]` 안쪽을 나눈다. `|` 뒤가 숫자면 크기, 아니면 별칭 */
export function parseEmbed(inner: string): EmbedParts {
  const bar = inner.indexOf('|')
  const head = bar === -1 ? inner : inner.slice(0, bar)
  const tail = bar === -1 ? '' : inner.slice(bar + 1).trim()
  const size = /^(\d+)(?:x\d+)?$/.exec(tail)
  const hash = head.indexOf('#')
  return {
    target: (hash === -1 ? head : head.slice(0, hash)).trim(),
    heading: hash === -1 ? null : head.slice(hash + 1).trim() || null,
    alias: size || !tail ? null : tail,
    width: size ? Number(size[1]) : null
  }
}

/** 확장자가 없거나 .md면 노트, 아니면 파일 */
export function isNoteTarget(target: string): boolean {
  return !HAS_EXT_RE.test(target) || NOTE_EXT_RE.test(target)
}

export function isImageTarget(target: string): boolean {
  return IMAGE_EXT_RE.test(target)
}

function normalize(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase()
}

function joinPath(dir: string, rel: string): string {
  const sep = sepOf(dir)
  const out: string[] = []
  for (const part of `${dir}${sep}${rel}`.split(/[\\/]/)) {
    if (part === '..') out.pop()
    else if (part !== '.' && part !== '') out.push(part)
  }
  return (dir.startsWith('/') ? '/' : '') + out.join(sep)
}

/**
 * 임베드한 파일을 찾는다. 노트 기준 상대 경로가 맞으면 그것을, 아니면 같은 이름 파일 중
 * 가까운 것(같은 폴더의 img/·files/ → 같은 폴더 → 나머지)을 고른다.
 */
export function resolveEmbedFile(target: string, noteDir: string, files: string[]): string | null {
  const byPath = new Map(files.map((f) => [normalize(f), f]))
  const direct = byPath.get(normalize(joinPath(noteDir, target)))
  if (direct) return direct
  const name = fileNameOf(target).toLowerCase()
  const candidates = files.filter((f) => fileNameOf(f).toLowerCase() === name)
  if (candidates.length === 0) return null
  const dir = normalize(noteDir)
  const rank = (f: string): number => {
    const d = normalize(dirOf(f))
    if (d === `${dir}/img` || d === `${dir}/files`) return 0
    if (d === dir) return 1
    if (d.startsWith(`${dir}/`)) return 2
    return 3
  }
  return [...candidates].sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0]
}

/** 두 절대 경로 사이의 상대 경로 (`/` 구분) */
export function relativePath(fromDir: string, to: string): string {
  const a = fromDir.split(/[\\/]/).filter(Boolean)
  const b = to.split(/[\\/]/).filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++
  return [...a.slice(i).map(() => '..'), ...b.slice(i)].join('/')
}

/** 제목 줄부터 같은 단계 이상의 다음 제목 직전까지 */
export function sliceHeadingSection(content: string, line: number): string {
  const lines = content.split(/\r?\n/)
  const level = /^ {0,3}(#{1,6})\s/.exec(lines[line - 1] ?? '')?.[1].length ?? 1
  let end = lines.length
  let fence = false
  for (let i = line; i < lines.length; i++) {
    if (/^ {0,3}(```|~~~)/.test(lines[i])) fence = !fence
    if (fence) continue
    const m = /^ {0,3}(#{1,6})\s/.exec(lines[i])
    if (m && m[1].length <= level) {
      end = i
      break
    }
  }
  return lines.slice(line - 1, end).join('\n')
}
