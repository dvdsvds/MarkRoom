import {
  button as uiButton,
  closeMenus,
  dropdown,
  HOVER_BG,
  icon,
  LINE,
  PALETTE,
  registerMenu,
  setOn,
  type DropItem
} from './uiKit'
import minusIcon from '../icons/minus.svg?raw'
import plusIcon from '../icons/plus.svg?raw'
import type { CellOptChange, CellOptState, FlagName, HAlign, VAlign } from '../editor/gridEdit'

export interface ToolbarApi {
  apply: (ch: CellOptChange) => void
  script: (kind: 'sup' | 'sub') => void
  scriptState?: () => 'sup' | 'sub' | null
  effective?: () => { fs: string | null; ff: string | null } | null
  selStyle?: () => {
    fs: string | null
    fc: string | null
    ff: string | null
    flags: Record<string, boolean> | null
  } | null
  read: () => CellOptState | null
}

export interface Toolbar {
  el: HTMLElement
  refresh: () => void
  setVisible: (on: boolean) => void
  syncScript: () => void
}

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']
const COLOR_KO: Record<string, string> = {
  red: '빨강',
  orange: '주황',
  yellow: '노랑',
  green: '초록',
  blue: '파랑',
  purple: '보라',
  gray: '회색'
}
const BASE_FONTS = [
  '맑은 고딕',
  '굴림',
  '돋움',
  '바탕',
  '궁서',
  '함초롬바탕',
  '함초롬돋움',
  '나눔고딕',
  '나눔명조',
  'Arial',
  'Times New Roman',
  'Consolas'
]

const ALIGN_ICON: Record<HAlign, string> = {
  left: icon('<path d="M2 3h12M2 6.5h8M2 10h12M2 13.5h8"/>'),
  center: icon('<path d="M2 3h12M4 6.5h8M2 10h12M4 13.5h8"/>'),
  right: icon('<path d="M2 3h12M6 6.5h8M2 10h12M6 13.5h8"/>'),
  justify: icon('<path d="M2 3h12M2 6.5h12M2 10h12M2 13.5h12"/>'),
  distribute: icon(
    '<path d="M2 3h12M2 8h12M2 13h12"/><path d="M4 5.5v0M8 5.5v0M12 5.5v0" stroke-width="2"/>'
  )
}
const ALIGN_KO: Record<HAlign, string> = {
  left: '왼쪽',
  center: '가운데',
  right: '오른쪽',
  justify: '양쪽',
  distribute: '배분'
}
const VALIGN_ICON: Record<VAlign, string> = {
  top: icon('<path d="M2 2.5h12"/><path d="M8 14V5.5M5 8.5l3-3 3 3"/>'),
  middle: icon('<path d="M2 8h12"/><path d="M8 2.5v3M6 4l2 2 2-2M8 13.5v-3M6 12l2-2 2 2"/>'),
  bottom: icon('<path d="M2 13.5h12"/><path d="M8 2v8.5M5 7.5l3 3 3-3"/>')
}
const VALIGN_KO: Record<VAlign, string> = { top: '위쪽', middle: '가운데', bottom: '아래쪽' }

function bar(): HTMLElement {
  const e = document.createElement('div')
  e.className = 'tq-toolbar'
  e.style.cssText = `position:sticky;top:0;z-index:5;display:none;flex-wrap:nowrap;align-items:center;gap:2px;padding:3px 6px;margin:0;background:var(--tq-bar);color:var(--tq-text);border-bottom:1px solid var(--tq-edge);font-size:13px;user-select:none;font-family:system-ui,sans-serif`
  e.addEventListener('mousedown', (ev) => {
    if (ev.target instanceof HTMLInputElement) return
    ev.preventDefault()
  })
  return e
}

function sep(): HTMLElement {
  const s = document.createElement('span')
  s.style.cssText = 'width:1px;height:18px;background:var(--tq-divider);margin:0 4px;flex:none'
  return s
}

const MORE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4l4 4-4 4M8.5 4l4 4-4 4"/></svg>'

/** 버튼 스타일에 display가 !important로 걸려 있을 수 있어서 같이 !important로 숨긴다. */
function setShown(el: HTMLElement, shown: boolean): void {
  if (shown) el.style.removeProperty('display')
  else el.style.setProperty('display', 'none', 'important')
}

const DEFAULT_FONT = 'Pretendard'
const DEFAULT_SIZE = '10'
const SIZE_PRESETS = [6, 7, 8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72, 96]

export function createToolbar(api: ToolbarApi): Toolbar {
  const root = bar()

  const button = (html: string, title: string, onClick: () => void): HTMLButtonElement =>
    uiButton(
      html,
      title,
      () => {
        closeMenus()
        onClick()
      },
      { square: true }
    )

  let fonts = [...BASE_FONTS]
  const lf = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> })
    .queryLocalFonts
  if (typeof lf === 'function') {
    void lf
      .call(window)
      .then((all) => {
        const fam = Array.from(new Set(all.map((f) => f.family))).sort((a, b) =>
          a.localeCompare(b, 'ko')
        )
        if (fam.length > 0) fonts = [...BASE_FONTS, ...fam.filter((f) => !BASE_FONTS.includes(f))]
      })
      .catch(() => undefined)
  }

  const font = dropdown({
    label: '글꼴',
    title: '글꼴',
    width: 110,
    flat: true,
    items: () => {
      const d = api.effective?.()?.ff
      const list = d && !fonts.includes(d) ? [d, ...fonts] : fonts
      return list.map((f): DropItem => ({
        text: f,
        value: f,
        css: `font-family:"${f}",sans-serif`
      }))
    },
    pick: (v) => api.apply({ kv: { ff: v } })
  })
  let shownSize = ''
  const sizeInput = document.createElement('input')
  sizeInput.type = 'text'
  sizeInput.inputMode = 'decimal'
  sizeInput.title = '글자 크기(pt): 숫자를 쓰고 Enter'
  sizeInput.style.cssText =
    'width:30px;height:24px;box-sizing:border-box;padding:0 2px;text-align:center;border:1px solid var(--tq-field-border);border-radius:4px;background:transparent;color:inherit;font-size:13px;font-family:inherit;outline:none'
  const syncSize = (): void => {
    sizeInput.value = shownSize
  }
  const sizeBox = document.createElement('div')
  sizeBox.style.cssText = 'position:relative;display:flex'
  const sizeMenu = document.createElement('div')
  sizeMenu.style.cssText =
    'display:none;position:absolute;left:50%;transform:translateX(-50%);top:100%;margin-top:3px;z-index:10001;min-width:56px;max-height:240px;overflow-y:auto;scrollbar-width:none;padding:4px;background:var(--tq-panel);color:var(--tq-text);border:' +
    LINE +
    ';border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.45);box-sizing:border-box'
  const closeSizeMenu = (): void => {
    sizeMenu.style.display = 'none'
  }
  const openSizeMenu = (): void => {
    closeMenus()
    sizeMenu.replaceChildren()
    for (const n of SIZE_PRESETS) {
      const row = document.createElement('div')
      row.textContent = String(n)
      row.style.cssText =
        'padding:5px 10px;border-radius:6px;cursor:pointer;text-align:center;font-size:13px'
      if (String(n) === shownSize) row.style.fontWeight = '700'
      row.addEventListener('mouseenter', () => (row.style.background = HOVER_BG))
      row.addEventListener('mouseleave', () => (row.style.background = ''))
      row.addEventListener('mousedown', (e) => e.preventDefault())
      row.addEventListener('click', () => {
        closeSizeMenu()
        api.apply({ kv: { fs: String(n) } })
        sizeInput.blur()
      })
      sizeMenu.appendChild(row)
    }
    sizeMenu.style.display = 'block'
  }
  registerMenu(sizeBox, closeSizeMenu)
  sizeBox.append(sizeInput, sizeMenu)
  sizeInput.addEventListener('focus', () => {
    sizeInput.select()
    openSizeMenu()
  })
  sizeInput.addEventListener('click', () => {
    if (sizeMenu.style.display === 'none') openSizeMenu()
  })
  sizeInput.addEventListener('keydown', (ev) => {
    ev.stopPropagation()
    if (ev.key === 'Enter') {
      ev.preventDefault()
      const n = Number(sizeInput.value.replace(',', '.'))
      if (!Number.isFinite(n) || n <= 0) {
        syncSize()
        return
      }
      api.apply({ kv: { fs: String(Math.min(400, Math.max(1, Math.round(n * 10) / 10))) } })
      closeSizeMenu()
      sizeInput.blur()
    } else if (ev.key === 'Escape') {
      ev.preventDefault()
      syncSize()
      closeSizeMenu()
      sizeInput.blur()
    }
  })
  sizeInput.addEventListener('blur', () => {
    syncSize()
    closeSizeMenu()
  })
  const stepSize = (dir: 1 | -1): void => {
    const cur = Number(shownSize) || 10
    const next = Math.min(400, Math.max(1, Math.round((cur + dir) * 10) / 10))
    if (next !== cur) api.apply({ kv: { fs: String(next) } })
  }
  const sizeWrap = document.createElement('div')
  sizeWrap.style.cssText = 'display:flex;align-items:center;gap:2px'
  sizeWrap.append(
    button(minusIcon.trim(), '글자 크기 줄이기', () => stepSize(-1)),
    sizeBox,
    button(plusIcon.trim(), '글자 크기 키우기', () => stepSize(1))
  )

  const flagBtn: Partial<Record<FlagName, HTMLButtonElement>> = {}
  const flag = (f: FlagName, html: string, title: string): HTMLButtonElement => {
    const b = button(html, title, () => {
      const st = api.read()
      api.apply({ flags: { [f]: !(st?.flags[f] ?? false) } })
    })
    flagBtn[f] = b
    return b
  }

  const fc = dropdown({
    flat: true,
    label: '글자색',
    title: '글자 색',
    width: 0,
    icon: '<b style="font-size:14px;font-family:serif;line-height:14px">A</b>',
    colorBar: true,
    palette: PALETTE,
    noneText: '기본(검정)',
    items: () => [],
    pick: (v) => api.apply({ kv: { fc: v } })
  })
  const bg = dropdown({
    flat: true,
    label: '배경색',
    title: '칸 배경 색',
    width: 0,
    icon: icon(
      '<path d="M3 9.5l5-5.5 4.5 4.5-5.5 5z"/><path d="M12.5 11c.8 1 1 1.6 1 2a1 1 0 0 1-2 0c0-.4.2-1 1-2z"/>',
      14
    ),
    colorBar: true,
    palette: PALETTE,
    noneText: '없음',
    items: () => [],
    pick: (v) => api.apply({ kv: { bg: v } })
  })

  const alignBtn: Partial<Record<HAlign, HTMLButtonElement>> = {}
  const valignBtn: Partial<Record<VAlign, HTMLButtonElement>> = {}

  const sepAlign = sep()
  const sepValign = sep()
  const sepScript = sep()
  root.append(font.wrap, sep(), sizeWrap, sep())
  root.append(
    flag('bold', '<b>B</b>', '굵게'),
    flag('italic', '<i style="font-family:serif">I</i>', '기울임'),
    flag('underline', '<u>U</u>', '밑줄'),
    flag('strike', '<s>S</s>', '취소선'),
    sep(),
    fc.wrap,
    bg.wrap,
    sepAlign
  )
  for (const a of Object.keys(ALIGN_ICON) as HAlign[]) {
    const b = button(ALIGN_ICON[a], `${ALIGN_KO[a]} 맞춤`, () => {
      const st = api.read()
      api.apply({ align: st?.align === a ? null : a })
    })
    alignBtn[a] = b
    root.appendChild(b)
  }
  root.appendChild(sepValign)
  for (const v of Object.keys(VALIGN_ICON) as VAlign[]) {
    const b = button(VALIGN_ICON[v], `세로 ${VALIGN_KO[v]}`, () => {
      const st = api.read()
      api.apply({ valign: st?.valign === v ? null : v })
    })
    valignBtn[v] = b
    root.appendChild(b)
  }
  const supBtn = button(
    '<span>x<sup style="font-size:9px">2</sup></span>',
    '위 첨자: 누르면 켜짐/꺼짐, 글자를 선택하고 누르면 바로 적용',
    () => api.script('sup')
  )
  const subBtn = button(
    '<span>x<sub style="font-size:9px">2</sub></span>',
    '아래 첨자: 누르면 켜짐/꺼짐, 글자를 선택하고 누르면 바로 적용',
    () => api.script('sub')
  )
  root.append(sepScript, supBtn, subBtn)

  // 좁아지면 맨 뒤 아이콘부터 하나씩 » 메뉴로 옮긴다 (정렬 ~ 아래 첨자)
  interface Entry {
    el: HTMLElement
    icon: string
    label: string
    gi: number
    active: () => boolean
    fn: () => void
  }
  const entries: Entry[] = []
  for (const a of Object.keys(ALIGN_ICON) as HAlign[])
    entries.push({
      el: alignBtn[a] as HTMLElement,
      icon: ALIGN_ICON[a],
      label: `${ALIGN_KO[a]} 맞춤`,
      gi: 0,
      active: () => api.read()?.align === a,
      fn: () => api.apply({ align: api.read()?.align === a ? null : a })
    })
  for (const v of Object.keys(VALIGN_ICON) as VAlign[])
    entries.push({
      el: valignBtn[v] as HTMLElement,
      icon: VALIGN_ICON[v],
      label: `세로 ${VALIGN_KO[v]}`,
      gi: 1,
      active: () => api.read()?.valign === v,
      fn: () => api.apply({ valign: api.read()?.valign === v ? null : v })
    })
  entries.push(
    {
      el: supBtn,
      icon: '<span style="font-size:13px">x<sup style="font-size:9px">2</sup></span>',
      label: '위 첨자',
      gi: 2,
      active: () => api.scriptState?.() === 'sup',
      fn: () => api.script('sup')
    },
    {
      el: subBtn,
      icon: '<span style="font-size:13px">x<sub style="font-size:9px">2</sub></span>',
      label: '아래 첨자',
      gi: 2,
      active: () => api.scriptState?.() === 'sub',
      fn: () => api.script('sub')
    }
  )
  const groupSeps = [sepAlign, sepValign, sepScript]
  let hiddenCount = 0

  let menu: HTMLDivElement | null = null
  const closeMore = (): void => {
    menu?.remove()
    menu = null
    window.removeEventListener('mousedown', onOutside, true)
    window.removeEventListener('keydown', onKey, true)
  }
  const onOutside = (e: MouseEvent): void => {
    const t = e.target as Node
    if (menu && !menu.contains(t) && !moreBtn.contains(t)) closeMore()
  }
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') closeMore()
  }
  const moreBtn: HTMLButtonElement = button(MORE_ICON, '더 보기', () => {
    if (menu) {
      closeMore()
      return
    }
    const hidden = entries.slice(entries.length - hiddenCount)
    if (hidden.length === 0) return
    const m = document.createElement('div')
    m.style.cssText =
      'position:fixed;z-index:10001;width:208px;padding:6px;box-sizing:border-box;background:var(--tq-panel);color:var(--tq-text);border:' +
      LINE +
      ';border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4);font-size:13px;font-family:system-ui,sans-serif;user-select:none'
    m.addEventListener('mousedown', (e) => e.preventDefault())
    hidden.forEach((it, i) => {
      if (i > 0 && hidden[i - 1].gi !== it.gi) {
        const line = document.createElement('div')
        line.style.cssText = 'height:1px;margin:6px 4px;background:var(--tq-divider)'
        m.appendChild(line)
      }
      const row = document.createElement('div')
      let on = false
      try {
        on = it.active()
      } catch {
        on = false
      }
      row.style.cssText =
        'display:flex;align-items:center;gap:10px;height:32px;padding:0 10px;border-radius:8px;cursor:pointer' +
        (on ? ';font-weight:700' : '')
      row.innerHTML = `<span style="display:flex;width:16px;height:16px;align-items:center;justify-content:center;opacity:.65">${it.icon}</span>${it.label}`
      row.addEventListener('mouseenter', () => (row.style.background = HOVER_BG))
      row.addEventListener('mouseleave', () => (row.style.background = ''))
      row.addEventListener('click', () => {
        closeMore()
        it.fn()
      })
      m.appendChild(row)
    })
    root.appendChild(m)
    const r = moreBtn.getBoundingClientRect()
    const mw = m.offsetWidth
    const mh = m.offsetHeight
    m.style.left = `${Math.max(8, Math.min(r.right - mw, window.innerWidth - mw - 8))}px`
    m.style.top = `${Math.max(8, Math.min(r.bottom + 6, window.innerHeight - mh - 8))}px`
    menu = m
    window.addEventListener('mousedown', onOutside, true)
    window.addEventListener('keydown', onKey, true)
  })
  setShown(moreBtn, false)
  moreBtn.style.marginLeft = '2px'
  root.appendChild(moreBtn)
  for (const c of Array.from(root.children) as HTMLElement[]) c.style.flex = 'none'

  const applyCollapse = (n: number): void => {
    hiddenCount = n
    entries.forEach((it, i) => setShown(it.el, i < entries.length - n))
    // 첫 묶음 앞 구분선은 » 앞 구분선으로 남기고, 나머지는 그 묶음이 보일 때만
    groupSeps.forEach((sp, gi) =>
      setShown(
        sp,
        gi === 0 ||
          entries.some((it) => it.gi === gi && it.el.style.getPropertyValue('display') !== 'none')
      )
    )
    setShown(moreBtn, n > 0)
  }
  const layout = (): void => {
    closeMore()
    if (root.style.display === 'none' || root.clientWidth === 0) return
    for (let n = 0; n <= entries.length; n++) {
      applyCollapse(n)
      if (root.scrollWidth <= root.clientWidth) break
    }
  }
  new ResizeObserver(layout).observe(root)

  const syncScript = (): void => {
    const k = api.scriptState?.() ?? null
    setOn(supBtn, k === 'sup')
    setOn(subBtn, k === 'sub')
  }

  const refresh = (): void => {
    let st: CellOptState | null = null
    try {
      st = api.read()
    } catch {
      st = null
    }
    let sel: ReturnType<NonNullable<ToolbarApi['selStyle']>> = null
    try {
      sel = api.selStyle?.() ?? null
    } catch {
      sel = null
    }
    for (const f of Object.keys(flagBtn) as FlagName[])
      setOn(flagBtn[f], !!(sel?.flags ? sel.flags[f] : st?.flags[f]))
    for (const a of Object.keys(alignBtn) as HAlign[]) setOn(alignBtn[a], st?.align === a)
    for (const v of Object.keys(valignBtn) as VAlign[]) setOn(valignBtn[v], st?.valign === v)
    let eff: { fs: string | null; ff: string | null } | null = null
    try {
      eff = api.effective?.() ?? null
    } catch {
      eff = null
    }
    font.set(sel?.ff ?? st?.ff ?? eff?.ff ?? DEFAULT_FONT)
    shownSize = sel?.fs ?? st?.fs ?? eff?.fs ?? DEFAULT_SIZE
    if (document.activeElement !== sizeInput) syncSize()
    const fcv = sel?.fc ?? st?.fc ?? null
    fc.set(
      fcv ? (COLOR_KO[fcv] ?? fcv) : '글자색',
      fcv ? (COLORS.includes(fcv) ? `var(--c-${fcv})` : fcv) : null
    )
    bg.set(
      st?.bg ? (COLOR_KO[st.bg] ?? st.bg) : '배경색',
      st?.bg ? (COLORS.includes(st.bg) ? `var(--c-${st.bg})` : st.bg) : null
    )
    syncScript()
  }
  const setVisible = (on: boolean): void => {
    root.style.display = on ? 'flex' : 'none'
    if (!on) {
      closeMenus()
      closeMore()
    } else {
      refresh()
      layout()
    }
  }
  return { el: root, refresh, setVisible, syncScript }
}
