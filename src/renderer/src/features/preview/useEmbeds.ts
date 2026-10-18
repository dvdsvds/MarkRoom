import { useEffect, useState, type RefObject } from 'react'
import { markdownRenderer } from '../../markdown/renderMarkdown'
import { useTabsStore } from '../../stores/tabsStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { flattenFilePaths, flattenNotes } from '../../utils/noteIndex'
import { dirOf, fileNameOf } from '../../utils/path'
import { snoteUrl } from '../../utils/snoteUrl'
import { findHeadingLine } from '../../utils/wikilink'
import {
  isImageTarget,
  relativePath,
  resolveEmbedFile,
  sliceHeadingSection
} from '../../utils/embed'

const MAX_DEPTH = 3
const REFRESH_DELAY_MS = 300

interface FillContext {
  /** 미리보기 자체의 첨부 기준 폴더. 파일 칩 링크를 여기 기준 상대 경로로 만든다 */
  rootDir: string
  files: string[]
  notes: { title: string; path: string }[]
  watched: Set<string>
  cancelled: () => boolean
}

function message(text: string): HTMLElement {
  const p = document.createElement('p')
  p.className = 'embed-message'
  p.textContent = text
  return p
}

async function readNote(path: string): Promise<string | null> {
  const tab = useTabsStore.getState().tabs.find((t) => t.filePath === path)
  if (tab) return tab.content
  try {
    return await window.api.workspace.readFile(path)
  } catch {
    return null
  }
}

function fillFile(span: HTMLElement, noteDir: string, ctx: FillContext): void {
  const target = span.dataset.embedFile ?? ''
  const path = resolveEmbedFile(target, noteDir, ctx.files)
  span.replaceChildren()
  if (!path) {
    span.append(message(`'${target}' 파일을 찾을 수 없어요.`))
    return
  }
  if (isImageTarget(target)) {
    const img = document.createElement('img')
    img.className = 'embed-image'
    img.src = snoteUrl(path)
    img.alt = fileNameOf(path)
    if (span.dataset.width) img.style.width = `${span.dataset.width}px`
    span.append(img)
    return
  }
  // 이미지가 아닌 파일은 칩으로 보여 주고, 누르면 기존 링크 처리로 그 파일을 연다
  const a = document.createElement('a')
  a.className = 'embed-chip'
  a.href = encodeURI(relativePath(ctx.rootDir, path))
  a.textContent = fileNameOf(path)
  span.append(a)
}

async function fillNote(
  box: HTMLElement,
  chain: string[],
  depth: number,
  ctx: FillContext
): Promise<void> {
  const title = box.dataset.embedNote ?? ''
  const heading = box.dataset.heading ?? null
  const header = document.createElement('div')
  header.className = 'embed-header'
  const link = document.createElement('span')
  link.className = 'wikilink'
  link.dataset.wikilink = title
  if (heading) link.dataset.heading = heading
  link.textContent = box.dataset.alias ?? (heading ? `${title} > ${heading}` : title)
  header.append(link)
  const body = document.createElement('div')
  body.className = 'embed-body'
  box.replaceChildren(header, body)

  const path = ctx.notes.find((n) => n.title === title)?.path
  if (!path) return void body.append(message(`'${title}' 노트를 찾을 수 없어요.`))
  if (chain.includes(path)) return void body.append(message('순환 임베드라 펼치지 않았어요.'))
  if (depth >= MAX_DEPTH) return void body.append(message('임베드가 너무 깊어서 펼치지 않았어요.'))
  ctx.watched.add(path)

  const content = await readNote(path)
  if (ctx.cancelled()) return
  if (content === null) return void body.append(message(`'${title}' 노트를 읽을 수 없어요.`))
  let section = content
  if (heading) {
    const line = findHeadingLine(content, heading)
    if (line === null) return void body.append(message(`'${heading}' 제목을 찾을 수 없어요.`))
    section = sliceHeadingSection(content, line)
  }
  body.innerHTML = markdownRenderer.render(section, dirOf(path))
  // 원본 노트의 체크박스라 여기서 눌러도 지금 노트의 줄을 바꾸지 않게 막는다
  for (const input of Array.from(body.querySelectorAll('input'))) input.disabled = true
  await fillContainer(body, dirOf(path), [...chain, path], depth + 1, ctx)
}

async function fillContainer(
  container: HTMLElement,
  noteDir: string,
  chain: string[],
  depth: number,
  ctx: FillContext
): Promise<void> {
  for (const span of Array.from(container.querySelectorAll<HTMLElement>('[data-embed-file]'))) {
    fillFile(span, noteDir, ctx)
  }
  const boxes = Array.from(container.querySelectorAll<HTMLElement>('[data-embed-note]'))
  for (const box of boxes) {
    if (ctx.cancelled()) return
    await fillNote(box, chain, depth, ctx)
  }
}

/**
 * `![[노트]]`, `![[img/그림.png]]` 자리를 채운다.
 * 원본 노트가 바뀌면(탭에서 편집하거나 밖에서 저장) 잠시 뒤 다시 채운다.
 */
export function useEmbeds(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string,
  baseDir: string | undefined,
  docKey: string | undefined
): void {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !baseDir) return
    if (!el.querySelector('[data-embed-note], [data-embed-file]')) return
    let cancelled = false
    const tree = useWorkspaceStore.getState().tree
    const selfPath = useTabsStore.getState().tabs.find((t) => t.id === docKey)?.filePath ?? null
    const ctx: FillContext = {
      rootDir: baseDir,
      files: flattenFilePaths(tree),
      notes: flattenNotes(tree),
      watched: new Set(),
      cancelled: () => cancelled
    }
    el.dataset.embedsPending = 'true'
    void fillContainer(el, baseDir, selfPath ? [selfPath] : [], 0, ctx).finally(() => {
      if (!cancelled) delete el.dataset.embedsPending
    })

    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = (): void => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setVersion((v) => v + 1), REFRESH_DELAY_MS)
    }
    const unsubTabs = useTabsStore.subscribe((state, prev) => {
      for (const path of ctx.watched) {
        const now = state.tabs.find((t) => t.filePath === path)?.content
        const before = prev.tabs.find((t) => t.filePath === path)?.content
        if (now !== before) return schedule()
      }
    })
    const unsubFile = window.api.workspace.onFileChanged((path) => {
      if (ctx.watched.has(path)) schedule()
    })
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      unsubTabs()
      unsubFile()
    }
  }, [containerRef, html, baseDir, docKey, version])
}
