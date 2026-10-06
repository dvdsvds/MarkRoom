import type { CellOptChange, CellOptState, FlagName, HAlign, VAlign } from './gridEdit'

export interface ToolbarApi {
  /** 선택한 칸(또는 편집 중인 칸)에 글자 모양·정렬을 적용한다. */
  apply: (ch: CellOptChange) => void
  /** 편집 중인 칸에서 선택한 글자를 위/아래 첨자 표시로 감싼다. */
  script: (kind: 'sup' | 'sub') => void
  /** 지금 대상이 된 칸들의 상태. 대상이 없으면 null. */
  read: () => CellOptState | null
}

export interface Toolbar {
  el: HTMLElement
  refresh: () => void
  setVisible: (on: boolean) => void
}

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray']
const COLOR_KO: Record<string, string> = {
  red: '빨강', orange: '주황', yellow: '노랑', green: '초록', blue: '파랑', purple: '보라', gray: '회색'
}
const SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48']
const BASE_FONTS = [
  '맑은 고딕', '굴림', '돋움', '바탕', '궁서', '함초롬바탕', '함초롬돋움', '나눔고딕', '나눔명조',
  'Arial', 'Times New Roman', 'Consolas'
]

const BTN =
  'min-width:28px;height:26px;padding:0 6px;display:inline-flex;align-items:center;justify-content:center;border:1px solid transparent;border-radius:5px;background:transparent;color:inherit;cursor:pointer;font-size:13px;white-space:nowrap'
const ON = 'color-mix(in srgb, var(--color-text) 20%, transparent)'

const icon = (inner: string): string =>
  `<svg width="16" height="16" viewBox="0 0 16 16" style="display:block" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none">${inner}</svg>`

const ALIGN_ICON: Record<HAlign, string> = {
  left: icon('<path d="M2 3h12M2 6.5h8M2 10h12M2 13.5h8"/>'),
  center: icon('<path d="M2 3h12M4 6.5h8M2 10h12M4 13.5h8"/>'),
  right: icon('<path d="M2 3h12M6 6.5h8M2 10h12M6 13.5h8"/>'),
  justify: icon('<path d="M2 3h12M2 6.5h12M2 10h12M2 13.5h12"/>'),
  distribute: icon('<path d="M2 3h12M2 8h12M2 13h12"/><path d="M4 5.5v0M8 5.5v0M12 5.5v0" stroke-width="2"/>')
}
const ALIGN_KO: Record<HAlign, string> = {
  left: '왼쪽', center: '가운데', right: '오른쪽', justify: '양쪽', distribute: '배분'
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
  e.style.cssText =
    'position:sticky;top:0;z-index:50;display:none;flex-wrap:wrap;align-items:center;gap:4px;padding:5px 8px;margin:0 0 6px;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-text-tertiary);border-radius:8px;font-size:13px;user-select:none;font-family:system-ui,sans-serif'
  // 막대를 눌러도 편집 중인 칸의 입력 위치와 글자 선택이 풀리지 않게 한다.
  e.addEventListener('mousedown', (ev) => ev.preventDefault())
  return e
}

function sep(): HTMLElement {
  const s = document.createElement('span')
  s.style.cssText = 'width:1px;height:18px;background:var(--color-text-tertiary);opacity:.5;margin:0 4px'
  return s
}

interface Item {
  text: string
  value: string | null
  css?: string
  swatch?: string
}

export function createToolbar(api: ToolbarApi): Toolbar {
  const root = bar()
  const closers: (() => void)[] = []
  const closeAll = (): void => closers.forEach((f) => f())
  document.addEventListener(
    'mousedown',
    (e) => {
      if (!(e.target instanceof Node) || !root.contains(e.target)) closeAll()
    },
    true
  )

  const button = (html: string, title: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement('button')
    b.type = 'button'
    b.title = title
    b.style.cssText = BTN
    b.innerHTML = html
    b.addEventListener('click', () => {
      closeAll()
      onClick()
    })
    return b
  }

  const dropdown = (
    label: string,
    title: string,
    width: number,
    items: () => Item[],
    pick: (v: string | null) => void
  ): { wrap: HTMLElement; set: (text: string, swatch?: string | null) => void } => {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'position:relative'
    const b = document.createElement('button')
    b.type = 'button'
    b.title = title
    b.style.cssText = `${BTN};justify-content:space-between;gap:6px;min-width:${width}px;border-color:var(--color-text-tertiary)`
    const txt = document.createElement('span')
    txt.textContent = label
    txt.style.cssText = 'overflow:hidden;text-overflow:ellipsis;max-width:' + (width + 40) + 'px'
    const dot = document.createElement('span')
    dot.style.cssText = 'display:none;width:12px;height:12px;border-radius:3px;border:1px solid var(--color-text-tertiary)'
    const caret = document.createElement('span')
    caret.textContent = '▾'
    caret.style.fontSize = '10px'
    b.append(dot, txt, caret)
    const menu = document.createElement('div')
    menu.style.cssText =
      'display:none;position:absolute;left:0;top:100%;margin-top:3px;z-index:60;min-width:100%;max-height:280px;overflow-y:auto;padding:4px;background:var(--color-bg);color:var(--color-text);border:1px solid var(--color-text-tertiary);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.35)'
    const close = (): void => {
      menu.style.display = 'none'
    }
    closers.push(close)
    b.addEventListener('click', () => {
      const open = menu.style.display !== 'none'
      closeAll()
      if (open) return
      menu.replaceChildren()
      for (const it of items()) {
        const row = document.createElement('div')
        row.style.cssText = `display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:5px;cursor:pointer;white-space:nowrap;${it.css ?? ''}`
        if (it.swatch) {
          const sw = document.createElement('span')
          sw.style.cssText = `width:14px;height:14px;border-radius:3px;border:1px solid var(--color-text-tertiary);background:${it.swatch}`
          row.appendChild(sw)
        }
        row.appendChild(document.createTextNode(it.text))
        row.addEventListener('mouseenter', () => (row.style.background = ON))
        row.addEventListener('mouseleave', () => (row.style.background = ''))
        row.addEventListener('click', () => {
          close()
          pick(it.value)
        })
        menu.appendChild(row)
      }
      menu.style.display = 'block'
    })
    wrap.append(b, menu)
    return {
      wrap,
      set: (text, swatch) => {
        txt.textContent = text
        dot.style.display = swatch ? 'block' : 'none'
        if (swatch) dot.style.background = swatch
      }
    }
  }

  // 글꼴 목록: 기본 후보에, 컴퓨터에 설치된 글꼴을 읽을 수 있으면 합친다.
  let fonts = [...BASE_FONTS]
  const lf = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts
  if (typeof lf === 'function') {
    void lf
      .call(window)
      .then((all) => {
        const fam = Array.from(new Set(all.map((f) => f.family))).sort((a, b) => a.localeCompare(b, 'ko'))
        if (fam.length > 0) fonts = [...BASE_FONTS, ...fam.filter((f) => !BASE_FONTS.includes(f))]
      })
      .catch(() => undefined)
  }

  const font = dropdown(
    '글꼴', '글꼴', 110,
    () => [
      { text: '기본 글꼴', value: null },
      ...fonts.map((f) => ({ text: f, value: f, css: `font-family:"${f}",sans-serif` }))
    ],
    (v) => api.apply({ kv: { ff: v } })
  )
  const size = dropdown(
    '크기', '글자 크기(pt)', 46,
    () => [{ text: '기본', value: null }, ...SIZES.map((s) => ({ text: s, value: s }))],
    (v) => api.apply({ kv: { fs: v } })
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

  const colorItems = (none: string): Item[] => [
    { text: none, value: null },
    ...COLORS.map((c) => ({ text: COLOR_KO[c], value: c, swatch: `var(--c-${c})` }))
  ]
  const fc = dropdown('글자색', '글자 색', 64, () => colorItems('기본(검정)'), (v) => api.apply({ kv: { fc: v } }))
  const bg = dropdown('배경색', '칸 배경 색', 64, () => colorItems('없음'), (v) => api.apply({ kv: { bg: v } }))

  const alignBtn: Partial<Record<HAlign, HTMLButtonElement>> = {}
  const valignBtn: Partial<Record<VAlign, HTMLButtonElement>> = {}

  root.append(font.wrap, size.wrap, sep())
  root.append(
    flag('bold', '<b>B</b>', '굵게'),
    flag('italic', '<i style="font-family:serif">I</i>', '기울임'),
    flag('underline', '<u>U</u>', '밑줄'),
    flag('strike', '<s>S</s>', '취소선'),
    sep(),
    fc.wrap,
    bg.wrap,
    sep()
  )
  for (const a of Object.keys(ALIGN_ICON) as HAlign[]) {
    const b = button(ALIGN_ICON[a], `${ALIGN_KO[a]} 맞춤`, () => {
      const st = api.read()
      api.apply({ align: st?.align === a ? null : a })
    })
    alignBtn[a] = b
    root.appendChild(b)
  }
  root.appendChild(sep())
  for (const v of Object.keys(VALIGN_ICON) as VAlign[]) {
    const b = button(VALIGN_ICON[v], `세로 ${VALIGN_KO[v]}`, () => {
      const st = api.read()
      api.apply({ valign: st?.valign === v ? null : v })
    })
    valignBtn[v] = b
    root.appendChild(b)
  }
  root.append(
    sep(),
    button('x<sup style="font-size:9px">2</sup>', '위 첨자: 글자를 선택하고 누르면 ^글자^', () => api.script('sup')),
    button('x<sub style="font-size:9px">2</sub>', '아래 첨자: 글자를 선택하고 누르면 ~글자~', () => api.script('sub'))
  )

  const mark = (b: HTMLButtonElement | undefined, on: boolean): void => {
    if (b) b.style.background = on ? ON : 'transparent'
  }
  const refresh = (): void => {
    let st: CellOptState | null = null
    try {
      st = api.read()
    } catch {
      st = null
    }
    root.style.opacity = st ? '1' : '0.55'
    for (const f of Object.keys(flagBtn) as FlagName[]) mark(flagBtn[f], !!st?.flags[f])
    for (const a of Object.keys(alignBtn) as HAlign[]) mark(alignBtn[a], st?.align === a)
    for (const v of Object.keys(valignBtn) as VAlign[]) mark(valignBtn[v], st?.valign === v)
    font.set(st?.ff ?? '글꼴')
    size.set(st?.fs ?? '크기')
    fc.set(st?.fc ? COLOR_KO[st.fc] ?? st.fc : '글자색', st?.fc ? (COLORS.includes(st.fc) ? `var(--c-${st.fc})` : st.fc) : null)
    bg.set(st?.bg ? COLOR_KO[st.bg] ?? st.bg : '배경색', st?.bg ? (COLORS.includes(st.bg) ? `var(--c-${st.bg})` : st.bg) : null)
  }
  const setVisible = (on: boolean): void => {
    root.style.display = on ? 'flex' : 'none'
    if (!on) closeAll()
    else refresh()
  }
  return { el: root, refresh, setVisible }
}