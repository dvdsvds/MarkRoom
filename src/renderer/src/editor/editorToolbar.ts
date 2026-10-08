import { keymap, showPanel, type EditorView, type Panel, type ViewUpdate } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { redo, undo } from '@codemirror/commands'
import wikilinkIcon from '../icons/wikilink.svg?raw'
import footnoteIcon from '../icons/footnote.svg?raw'
import bulletIcon from '../icons/list-bullet.svg?raw'
import numberIcon from '../icons/list-number.svg?raw'
import checkIcon from '../icons/list-check.svg?raw'
import codeInlineIcon from '../icons/code-inline.svg?raw'
import { button, closeMenus, dropdown, icon, PALETTE, setOn, type DropItem } from '../components/uiKit'
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

const ICON = {
  link: icon('<path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2.5-2.5a2.5 2.5 0 0 0-3.5-3.5L8 4.5"/><path d="M9.5 6.5a2.5 2.5 0 0 0-3.5 0L3.5 9a2.5 2.5 0 0 0 3.5 3.5L8 11.5"/>'),
  undo: icon('<path d="M5 3L2.5 5.5 5 8"/><path d="M2.5 5.5H9a4 4 0 0 1 0 8H6"/>'),
  redo: icon('<path d="M11 3l2.5 2.5L11 8"/><path d="M13.5 5.5H7a4 4 0 0 0 0 8h3"/>'),
  table: icon('<rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M2.5 7h11M2.5 10h11M7 3v10"/>'),
  codeBlock: icon('<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M6.5 6.5L5 8l1.5 1.5M9.5 6.5L11 8 9.5 9.5"/>'),
  rule: icon('<path d="M2.5 8h11"/><path d="M5 4.5h6M5 11.5h6" opacity=".4"/>'),
  bucket: icon('<path d="M3 9.5l5-5.5 4.5 4.5-5 5z"/><path d="M12.5 11c.8 1 1 1.6 1 2a1 1 0 0 1-2 0c0-.4.2-1 1-2z"/>', 16)
}

const sep = (): HTMLElement => {
  const s = document.createElement('span')
  s.style.cssText = 'width:1px;height:18px;background:var(--tq-divider);margin:0 4px;flex:none'
  return s
}

function build(view: EditorView): Panel {
  const dom = document.createElement('div')
  dom.className = 'md-toolbar'
  dom.style.cssText =
    'display:flex;align-items:center;gap:2px;padding:3px 6px;background:var(--tq-bar);color:var(--tq-text);border-bottom:1px solid var(--tq-edge);font-size:13px;user-select:none;font-family:system-ui,sans-serif'
  dom.addEventListener('mousedown', (e) => e.preventDefault())

  const row = document.createElement('div')
  row.style.cssText = 'display:flex;align-items:center;gap:2px;flex:1;min-width:0;flex-wrap:wrap'
  const btn = (html: string, title: string, fn: () => void): HTMLButtonElement =>
    button(html, title, () => {
      closeMenus()
      fn()
    }, { square: true })

  const bold = btn('<b style="font-size:17px;line-height:1">B</b>', '굵게 (Ctrl+B)', () => toggleWrap(view, '**'))
  const italic = btn('<i style="font-family:serif;font-size:18px;line-height:1">I</i>', '기울임 (Ctrl+I)', () => toggleWrap(view, '*'))
  const strike = btn('<s style="font-size:17px;line-height:1">S</s>', '취소선', () => toggleWrap(view, '~~'))
  const code = btn(codeInlineIcon.trim(), '인라인 코드', () => toggleWrap(view, '`'))
  const link = btn(ICON.link, '링크', () => insertLink(view))

  const heading = dropdown({
    label: '본문',
    title: '제목',
    width: 56,
    flat: true,
    items: () => HEADINGS,
    pick: (v) => setHeading(view, Number(v ?? 0))
  })
  const bullet = btn(bulletIcon.trim(), '글머리 기호', () => toggleList(view, 'ul'))
  const numbered = btn(numberIcon.trim(), '번호 목록', () => toggleList(view, 'ol'))
  const task = btn(checkIcon.trim(), '체크리스트', () => toggleList(view, 'task'))
  const quote = btn('<span style="font-size:17px;line-height:1;font-family:serif">“</span>', '인용', () => toggleQuote(view))
  const wiki = btn(wikilinkIcon.trim(), '위키링크', () => insertWikilink(view))
  const foot = btn(footnoteIcon.trim(), '각주', () => insertFootnote(view))
  const table = btn(ICON.table, '표', () => insertTable(view))
  const codeBlock = btn(ICON.codeBlock, '코드 블록', () => insertCodeBlock(view))
  const rule = btn(ICON.rule, '구분선', () => insertRule(view))
  
  const fg = dropdown({
    label: '글자색',
    title: '글자 색',
    width: 0,
    flat: true,
    icon: '<b style="font-size:14px;font-family:serif;line-height:14px">A</b>',
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
    icon: ICON.bucket,
    colorBar: true,
    palette: PALETTE,
    noneText: '없음',
    items: () => [],
    pick: (v) => applyColor(view, 'bg', v)
  })
  const undoB = btn(ICON.undo, '되돌리기', () => undo(view))
  const redoB = btn(ICON.redo, '다시 실행', () => redo(view))

  row.append(
    undoB, redoB, sep(),
    heading.wrap, bold, italic, strike, code, fg.wrap, bgc.wrap, sep(),
    bullet, numbered, task, quote, sep(),
    link, wiki, foot, sep(),
    table, codeBlock, rule, sep(),
  )

  dom.append(row)

  const refresh = (): void => {
    const s = view.state
    const r = s.selection.main
    setOn(bold, isWrapped(s, r, '**'))
    setOn(italic, isWrapped(s, r, '*'))
    setOn(strike, isWrapped(s, r, '~~'))
    setOn(code, isWrapped(s, r, '`'))
    const lv = headingLevel(s)
    heading.set(lv === 0 ? '본문' : `제목 ${lv}`)
    const cs = colorSpanAt(s, r.from, r.to)
    const css = (c: string | null): string | null => (c ? (c.startsWith('#') ? c : `var(--c-${c})`) : null)
    fg.set('글자색', css(cs?.fg ?? null))
    bgc.set('배경색', css(cs?.bg ?? null))
  }
  refresh()

  return {
    dom,
    top: true,
    update(u: ViewUpdate) {
      if (u.selectionSet || u.docChanged) refresh()
    }
  }
}

/** 에디터 위쪽에 마크다운 툴바 패널을 붙인다. */
export const mdToolbar = [
  showPanel.of((view) => build(view)),
  Prec.low(
    keymap.of([
      { key: 'Mod-b', run: (v) => (toggleWrap(v, '**'), true) },
      { key: 'Mod-i', run: (v) => (toggleWrap(v, '*'), true) },
      { key: 'Mod-k', run: (v) => (insertLink(v), true) },
    ])
  )
]