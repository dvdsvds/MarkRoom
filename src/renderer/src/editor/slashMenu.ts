import { EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view'
import { Prec, type EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import headingIcon from '../icons/ctx-heading.svg?raw'
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
import strikeIcon from '../icons/tb-strike.svg?raw'
import codeInlineIcon from '../icons/tb-code-inline.svg?raw'
import textColorIcon from '../icons/tb-text-color.svg?raw'
import highlightIcon from '../icons/tb-highlight.svg?raw'
import {
  applyColor,
  toggleWrap,
  insertCodeBlock,
  insertFootnote,
  insertLink,
  insertRule,
  insertTable,
  insertWikilink,
  setHeading,
  toggleList,
  toggleQuote
} from './mdCommands'

interface SlashCmd {
  cmd: string
  label: string
  icon: string
  group: number
  run: (view: EditorView) => void
}

const CMDS: SlashCmd[] = [
  { cmd: 'h1', label: '제목 1', icon: headingIcon, group: 0, run: (v) => setHeading(v, 1) },
  { cmd: 'h2', label: '제목 2', icon: headingIcon, group: 0, run: (v) => setHeading(v, 2) },
  { cmd: 'h3', label: '제목 3', icon: headingIcon, group: 0, run: (v) => setHeading(v, 3) },
  { cmd: 'ul', label: '글머리 기호', icon: bulletIcon, group: 1, run: (v) => toggleList(v, 'ul') },
  { cmd: 'ol', label: '번호 목록', icon: numberIcon, group: 1, run: (v) => toggleList(v, 'ol') },
  {
    cmd: 'todo',
    label: '체크리스트',
    icon: checkIcon,
    group: 1,
    run: (v) => toggleList(v, 'task')
  },
  { cmd: 'quote', label: '인용', icon: quoteIcon, group: 1, run: (v) => toggleQuote(v) },
  { cmd: 'link', label: '링크', icon: linkIcon, group: 2, run: (v) => insertLink(v) },
  { cmd: 'wiki', label: '위키링크', icon: wikilinkIcon, group: 2, run: (v) => insertWikilink(v) },
  { cmd: 'foot', label: '각주', icon: footnoteIcon, group: 2, run: (v) => insertFootnote(v) },
  { cmd: 'table', label: '표', icon: tableIcon, group: 3, run: (v) => insertTable(v) },
  {
    cmd: 'code',
    label: '코드 블록',
    icon: codeBlockIcon,
    group: 3,
    run: (v) => insertCodeBlock(v)
  },
  { cmd: 'rule', label: '구분선', icon: ruleIcon, group: 3, run: (v) => insertRule(v) },
  { cmd: 'strike', label: '취소선', icon: strikeIcon, group: 4, run: (v) => toggleWrap(v, '~~') },
  { cmd: 'icode', label: '인라인 코드', icon: codeInlineIcon, group: 4, run: (v) => toggleWrap(v, '`') },
  { cmd: 'color', label: '글자색', icon: textColorIcon, group: 4, run: (v) => applyColor(v, 'fg', 'red') },
  { cmd: 'bg', label: '배경색', icon: highlightIcon, group: 4, run: (v) => applyColor(v, 'bg', 'yellow') }
]

const TRIGGER = /(?:^|\s)\/([A-Za-z0-9가-힣]*)$/

function filterCmds(query: string): SlashCmd[] {
  const q = query.toLowerCase()
  if (!q) return CMDS
  return CMDS.filter((c) => c.cmd.startsWith(q) || c.label.replace(/\s/g, '').includes(q))
}

/** 커서 바로 앞이 "/글자" 모양이고 코드 안이 아니면 슬래시 위치와 입력한 글자를 돌려준다. */
function findTrigger(state: EditorState): { from: number; query: string } | null {
  const sel = state.selection
  if (sel.ranges.length !== 1 || !sel.main.empty) return null
  const pos = sel.main.head
  const line = state.doc.lineAt(pos)
  const m = TRIGGER.exec(line.text.slice(0, pos - line.from))
  if (!m) return null
  for (let n: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); n; n = n.parent) {
    if (/Code/.test(n.name)) return null
  }
  return { from: pos - m[1].length - 1, query: m[1] }
}

class SlashPlugin {
  open = false
  from = 0
  query = ''
  items: SlashCmd[] = []
  sel = 0
  el: HTMLDivElement | null = null
  /** Esc 등으로 닫은 슬래시 위치. 같은 슬래시에서는 다시 열지 않는다. */
  dismissed: number | null = null

  private onOutside = (e: MouseEvent): void => {
    if (this.el && !this.el.contains(e.target as Node)) this.dismiss()
  }
  private onScroll = (): void => {
    this.dismiss()
  }

  constructor(readonly view: EditorView) {
    view.scrollDOM.addEventListener('scroll', this.onScroll, { passive: true })
  }

  update(u: ViewUpdate): void {
    if (!u.docChanged && !u.selectionSet) return
    const m = findTrigger(u.state)
    if (!m) {
      this.dismissed = null
      this.close()
      return
    }
    if (this.dismissed === m.from) {
      this.close()
      return
    }
    const typed = u.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'))
    if (!this.open && !(u.docChanged && typed)) return
    if (this.open && m.from !== this.from) {
      this.close()
      return
    }
    this.show(m.from, m.query)
  }

  show(from: number, query: string): void {
    const items = filterCmds(query)
    if (items.length === 0) {
      this.close()
      return
    }
    if (!this.open || query !== this.query) this.sel = 0
    this.open = true
    this.from = from
    this.query = query
    this.items = items
    this.render()
  }

  render(): void {
    const m = this.el ?? document.createElement('div')
    if (!this.el) {
      m.className = 'md-ovf-menu ctx-menu slash-menu'
      m.addEventListener('mousedown', (e) => e.preventDefault())
      document.body.append(m)
      this.el = m
      window.addEventListener('mousedown', this.onOutside, true)
    }
    m.replaceChildren()
    this.items.forEach((it, i) => {
      if (i > 0 && this.items[i - 1].group !== it.group) {
        const line = document.createElement('div')
        line.className = 'md-ovf-sep'
        m.append(line)
      }
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'md-ovf-item' + (i === this.sel ? ' on' : '')
      b.innerHTML = `<span class="md-ovf-ico">${it.icon.trim()}</span>${it.label}<em class="slash-hint">/${it.cmd}</em>`
      b.addEventListener('mousemove', () => {
        if (this.sel === i) return
        this.sel = i
        this.render()
      })
      b.addEventListener('click', () => this.accept(i))
      m.append(b)
    })
    this.place()
  }

  place(): void {
    // 업데이트 도중에는 에디터 레이아웃을 읽을 수 없어서, 측정 단계로 미룬다.
    this.view.requestMeasure({
      key: this,
      read: (view) => {
        const m = this.el
        if (!m) return null
        const c = view.coordsAtPos(view.state.selection.main.head)
        return c ? { c, w: m.offsetWidth, h: m.offsetHeight } : null
      },
      write: (r) => {
        const m = this.el
        if (!r || !m) return
        const below = r.c.bottom + 6
        const top = below + r.h > window.innerHeight - 8 ? Math.max(8, r.c.top - 6 - r.h) : below
        m.style.left = `${Math.max(8, Math.min(r.c.left, window.innerWidth - r.w - 8))}px`
        m.style.top = `${top}px`
        m.querySelector('.on')?.scrollIntoView({ block: 'nearest' })
      }
    })
  }

  move(d: number): boolean {
    if (!this.open) return false
    this.sel = (this.sel + d + this.items.length) % this.items.length
    this.render()
    return true
  }

  accept(i = this.sel): boolean {
    if (!this.open) return false
    const item = this.items[i]
    const from = this.from
    const to = this.view.state.selection.main.head
    this.close()
    this.view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: from } })
    const before = this.view.state.doc.length
    item.run(this.view)
    // 제목, 목록처럼 줄 앞에 기호만 붙이는 명령은 커서를 그대로 둬서 기호 앞에 남는다. 붙은 글자 뒤로 옮긴다.
    const st = this.view.state
    const grew = st.doc.length - before
    if (grew > 0 && st.selection.main.empty && st.selection.main.head === from) {
      this.view.dispatch({ selection: { anchor: Math.min(st.doc.length, from + grew) } })
    }
    this.view.focus()
    return true
  }

  dismiss(): boolean {
    if (!this.open) return false
    this.dismissed = this.from
    this.close()
    return true
  }

  close(): void {
    this.open = false
    this.el?.remove()
    this.el = null
    window.removeEventListener('mousedown', this.onOutside, true)
  }

  destroy(): void {
    this.close()
    this.view.scrollDOM.removeEventListener('scroll', this.onScroll)
  }
}

const slashPlugin = ViewPlugin.fromClass(SlashPlugin, {
  eventHandlers: {
    blur() {
      this.dismiss()
    }
  }
})

const get = (v: EditorView): SlashPlugin | null => v.plugin(slashPlugin)

/** 줄 맨 앞이나 공백 뒤에서 "/"를 치면 마크다운 명령 메뉴를 띄운다. */
export const slashMenu = [
  slashPlugin,
  Prec.highest(
    keymap.of([
      { key: 'ArrowDown', run: (v) => get(v)?.move(1) ?? false },
      { key: 'ArrowUp', run: (v) => get(v)?.move(-1) ?? false },
      { key: 'Enter', run: (v) => get(v)?.accept() ?? false },
      { key: 'Tab', run: (v) => get(v)?.accept() ?? false },
      { key: 'Escape', run: (v) => get(v)?.dismiss() ?? false }
    ])
  )
]
