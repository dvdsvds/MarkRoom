import { keymap, showPanel, type EditorView, type Panel, type ViewUpdate } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { redo, undo } from '@codemirror/commands'
import undoIcon from '../icons/tb-undo.svg?raw'
import redoIcon from '../icons/tb-redo.svg?raw'
import boldIcon from '../icons/tb-bold.svg?raw'
import italicIcon from '../icons/tb-italic.svg?raw'
import strikeIcon from '../icons/tb-strike.svg?raw'
import codeInlineIcon from '../icons/tb-code-inline.svg?raw'
import textColorIcon from '../icons/tb-text-color.svg?raw'
import highlightIcon from '../icons/tb-highlight.svg?raw'
import bulletIcon from '../icons/tb-list-bullet.svg?raw'
import numberIcon from '../icons/tb-list-number.svg?raw'
import checkIcon from '../icons/tb-list-check.svg?raw'
import quoteIcon from '../icons/tb-quote.svg?raw'
import linkIcon from '../icons/tb-link.svg?raw'
import wikilinkIcon from '../icons/tb-wikilink.svg?raw'
import footnoteIcon from '../icons/tb-footnote.svg?raw'
import tableIcon from '../icons/tb-table.svg?raw'
import codeBlockIcon from '../icons/tb-code-block.svg?raw'
import ruleIcon from '../icons/tb-rule.svg?raw'
import { closeMenus, dropdown, icon, PALETTE, type DropItem } from '../components/uiKit'
import {
  applyColor,
  insertCodeBlock,
  insertFootnote,
  insertRule,
  insertTable,
  insertWikilink,
  colorSpanAt,
  headingLevel,
  insertLink,
  isWrapped,
  setHeading,
  toggleList,
  toggleQuote,
  toggleWrap
} from './mdCommands'

const HEADINGS: DropItem[] = [
  { text: '본문', value: '0' },
  ...[2, 3, 4, 5, 6].map((n): DropItem => ({
    text: `제목 ${n}`,
    value: String(n),
    css: `font-weight:700;font-size:${[0, 0, 17, 16, 15, 14, 13][n]}px`
  })),
  { text: '제목 1', value: '1', sepBefore: true, css: 'font-weight:700;font-size:19px' }
]

const moreIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4l4 4-4 4M8.5 4l4 4-4 4"/></svg>'

interface OverflowEntry {
  icon: string
  label: string
  fn: () => void
}

/** .md-tb-btn의 display가 !important라서 style.display = 'none'이 안 먹는다. 같이 !important로 숨긴다. */
function setShown(el: HTMLElement, shown: boolean): void {
  if (shown) el.style.removeProperty('display')
  else el.style.setProperty('display', 'none', 'important')
}

const sep = (): HTMLElement => {
  const s = document.createElement('span')
  s.className = 'md-tb-sep'
  return s
}

/** 툴바 아이콘 버튼. 모양은 main.css의 .md-tb-btn이 정한다. */
function tbBtn(html: string, title: string, fn: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.title = title
  b.className = 'md-tb-btn'
  b.innerHTML = html
  b.addEventListener('mousedown', (e) => e.preventDefault())
  b.addEventListener('click', () => {
    closeMenus()
    fn()
  })
  return b
}

function setActive(b: HTMLElement, on: boolean): void {
  b.classList.toggle('on', on)
  b.setAttribute('aria-pressed', on ? 'true' : 'false')
}

function build(view: EditorView): Panel {
  const dom = document.createElement('div')
  dom.className = 'md-toolbar'
  dom.addEventListener('mousedown', (e) => e.preventDefault())

  const row = document.createElement('div')
  row.className = 'md-toolbar-row'

  const bold = tbBtn(boldIcon.trim(), '굵게 (Ctrl+B)', () => toggleWrap(view, '**'))
  const italic = tbBtn(italicIcon.trim(), '기울임 (Ctrl+I)', () => toggleWrap(view, '*'))
  const strike = tbBtn(strikeIcon.trim(), '취소선', () => toggleWrap(view, '~~'))
  const code = tbBtn(codeInlineIcon.trim(), '인라인 코드', () => toggleWrap(view, '`'))
  const link = tbBtn(linkIcon.trim(), '링크 (Ctrl+K)', () => insertLink(view))

  const heading = dropdown({
    label: '본문',
    title: '제목',
    width: 56,
    flat: true,
    items: () => HEADINGS,
    pick: (v) => setHeading(view, Number(v ?? 0))
  })
  heading.wrap.classList.add('md-tb-heading')
  const headingCaret = heading.wrap.querySelector('button')?.lastElementChild
  if (headingCaret) headingCaret.innerHTML = icon('<path d="M4.5 6.5L8 10l3.5-3.5"/>', 12)

  const bullet = tbBtn(bulletIcon.trim(), '글머리 기호', () => toggleList(view, 'ul'))
  const numbered = tbBtn(numberIcon.trim(), '번호 목록', () => toggleList(view, 'ol'))
  const task = tbBtn(checkIcon.trim(), '체크리스트', () => toggleList(view, 'task'))
  const quote = tbBtn(quoteIcon.trim(), '인용', () => toggleQuote(view))
  const wiki = tbBtn(wikilinkIcon.trim(), '위키링크', () => insertWikilink(view))
  const foot = tbBtn(footnoteIcon.trim(), '각주', () => insertFootnote(view))
  const table = tbBtn(tableIcon.trim(), '표', () => insertTable(view))
  const codeBlock = tbBtn(codeBlockIcon.trim(), '코드 블록', () => insertCodeBlock(view))
  const rule = tbBtn(ruleIcon.trim(), '구분선', () => insertRule(view))

  const fg = dropdown({
    label: '글자색',
    title: '글자 색',
    width: 0,
    flat: true,
    icon: textColorIcon.trim(),
    colorBar: true,
    palette: PALETTE,
    noneText: '기본',
    items: () => [],
    pick: (v) => applyColor(view, 'fg', v)
  })
  const bgc = dropdown({
    label: '배경색',
    title: '배경 색',
    width: 0,
    flat: true,
    icon: highlightIcon.trim(),
    colorBar: true,
    palette: PALETTE,
    noneText: '없음',
    items: () => [],
    pick: (v) => applyColor(view, 'bg', v)
  })
  fg.wrap.classList.add('md-tb-color')
  bgc.wrap.classList.add('md-tb-color')
  const undoB = tbBtn(undoIcon.trim(), '되돌리기 (Ctrl+Z)', () => undo(view))
  const redoB = tbBtn(redoIcon.trim(), '다시 실행 (Ctrl+Y)', () => redo(view))

  const sepList = sep()
  const sepLink = sep()
  const sepTable = sep()
  const more = tbBtn(moreIcon, '더 보기', () => toggleMenu())
  setShown(more, false)
  more.style.marginLeft = '2px'

  // 좁아져서 아이콘이 가려질 때마다 맨 뒤 아이콘부터 하나씩 » 메뉴로 옮긴다
  const groups: { sep: HTMLElement; els: HTMLElement[]; entries: OverflowEntry[] }[] = [
    {
      sep: sepList,
      els: [bullet, numbered, task, quote],
      entries: [
        { icon: bulletIcon, label: '글머리 기호', fn: () => toggleList(view, 'ul') },
        { icon: numberIcon, label: '번호 목록', fn: () => toggleList(view, 'ol') },
        { icon: checkIcon, label: '체크리스트', fn: () => toggleList(view, 'task') },
        { icon: quoteIcon, label: '인용', fn: () => toggleQuote(view) }
      ]
    },
    {
      sep: sepLink,
      els: [link, wiki, foot],
      entries: [
        { icon: linkIcon, label: '링크', fn: () => insertLink(view) },
        { icon: wikilinkIcon, label: '위키링크', fn: () => insertWikilink(view) },
        { icon: footnoteIcon, label: '각주', fn: () => insertFootnote(view) }
      ]
    },
    {
      sep: sepTable,
      els: [table, codeBlock, rule],
      entries: [
        { icon: tableIcon, label: '표', fn: () => insertTable(view) },
        { icon: codeBlockIcon, label: '코드 블록', fn: () => insertCodeBlock(view) },
        { icon: ruleIcon, label: '구분선', fn: () => insertRule(view) }
      ]
    }
  ]
  const flat = groups.flatMap((g, gi) => g.els.map((el, i) => ({ el, entry: g.entries[i], gi })))
  let hiddenCount = 0

  let menu: HTMLDivElement | null = null
  const closeMenu = (): void => {
    menu?.remove()
    menu = null
    window.removeEventListener('mousedown', onOutside, true)
    window.removeEventListener('keydown', onKey, true)
  }
  const onOutside = (e: MouseEvent): void => {
    const t = e.target as Node
    if (menu && !menu.contains(t) && !more.contains(t)) closeMenu()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeMenu()
  }
  function toggleMenu(): void {
    if (menu) {
      closeMenu()
      return
    }
    const hidden = flat.slice(flat.length - hiddenCount)
    if (hidden.length === 0) return
    const m = document.createElement('div')
    m.className = 'md-ovf-menu ctx-menu'
    m.addEventListener('mousedown', (e) => e.preventDefault())
    hidden.forEach((it, i) => {
      if (i > 0 && hidden[i - 1].gi !== it.gi) {
        const line = document.createElement('div')
        line.className = 'md-ovf-sep'
        m.append(line)
      }
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'md-ovf-item'
      b.innerHTML = `<span class="md-ovf-ico">${it.entry.icon.trim()}</span>${it.entry.label}`
      b.addEventListener('click', () => {
        closeMenu()
        it.entry.fn()
      })
      m.append(b)
    })
    document.body.append(m)
    const r = more.getBoundingClientRect()
    const mw = m.offsetWidth
    const mh = m.offsetHeight
    m.style.left = `${Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8))}px`
    m.style.top = `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - mh - 8))}px`
    menu = m
    closeMenus()
    window.addEventListener('mousedown', onOutside, true)
    window.addEventListener('keydown', onKey, true)
  }

  const applyCollapse = (n: number): void => {
    hiddenCount = n
    flat.forEach((it, i) => setShown(it.el, i < flat.length - n))
    // 묶음 구분선: 그 묶음 아이콘이 하나라도 보일 때만. 첫 묶음 앞 선은 » 앞 구분선으로 남긴다
    groups.forEach((g, gi) =>
      setShown(g.sep, gi === 0 || g.els.some((el) => el.style.getPropertyValue('display') !== 'none'))
    )
    setShown(more, n > 0)
  }
  const layout = (): void => {
    closeMenu()
    for (let n = 0; n <= flat.length; n++) {
      applyCollapse(n)
      if (row.scrollWidth <= row.clientWidth) break
    }
  }
  const ro = new ResizeObserver(layout)

  row.append(
    undoB,
    redoB,
    sep(),
    heading.wrap,
    bold,
    italic,
    strike,
    code,
    fg.wrap,
    bgc.wrap,
    sepList,
    bullet,
    numbered,
    task,
    quote,
    sepLink,
    link,
    wiki,
    foot,
    sepTable,
    table,
    codeBlock,
    rule,
    more
  )

  dom.append(row)
  ro.observe(row)

  const refresh = (): void => {
    const s = view.state
    const r = s.selection.main
    setActive(bold, isWrapped(s, r, '**'))
    setActive(italic, isWrapped(s, r, '*'))
    setActive(strike, isWrapped(s, r, '~~'))
    setActive(code, isWrapped(s, r, '`'))
    const lv = headingLevel(s)
    heading.set(lv === 0 ? '본문' : `제목 ${lv}`)
    const cs = colorSpanAt(s, r.from, r.to)
    const css = (c: string | null): string | null =>
      c ? (c.startsWith('#') ? c : `var(--c-${c})`) : null
    fg.set('글자색', css(cs?.fg ?? null))
    bgc.set('배경색', css(cs?.bg ?? null))
  }
  refresh()

  return {
    dom,
    top: true,
    destroy() {
      ro.disconnect()
      closeMenu()
    },
    update(u: ViewUpdate) {
      if (u.selectionSet || u.docChanged) refresh()
    }
  }
}

/** 툴바 패널만. 설정에서 켜고 끌 수 있게 따로 내보낸다. */
export const mdToolbarPanel = showPanel.of((view) => build(view))

/** 굵게/기울임/링크 단축키. 툴바를 꺼도 계속 쓸 수 있다. */
export const mdToolbarKeys = Prec.low(
  keymap.of([
    { key: 'Mod-b', run: (v) => (toggleWrap(v, '**'), true) },
    { key: 'Mod-i', run: (v) => (toggleWrap(v, '*'), true) },
    { key: 'Mod-k', run: (v) => (insertLink(v), true) }
  ])
)

/** 에디터 위쪽에 마크다운 툴바 패널을 붙인다. */
export const mdToolbar = [mdToolbarPanel, mdToolbarKeys]