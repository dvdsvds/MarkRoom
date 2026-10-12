const THEME = `:root{
--tq-panel:#1b1c20;--tq-edge:#38393f;--tq-divider:#2a2b30;
--tq-field-bg:#222328;--tq-field-hover:#2a2b30;--tq-field-border:#4e5057;--tq-field-border-hover:#5b5d64;
--tq-text:#e6e6e6;--tq-text2:#9d9e9f;--tq-text3:#686b73;
--tq-key-bg:#1e1f23;--tq-key-border:#33353a;
--tq-toast-bg:#25262b;--tq-danger:#e5484d;
--tq-pv-border:#5b5d64;--tq-pv-off:#4e5057;
--tq-accent:#6d93ff;--tq-on-bg:#23304f;--tq-bar:#161719;--tq-ink:#111111}`
if (typeof document !== 'undefined' && !document.getElementById('tq-ui-theme')) {
  const st = document.createElement('style')
  st.id = 'tq-ui-theme'
  st.textContent = THEME
  document.head.appendChild(st)
}

export const LINE = '1px solid var(--tq-edge)'
export const DIV = '1px solid var(--tq-divider)'
export const ON_BG = 'var(--tq-on-bg)'
export const HOVER_BG = 'var(--tq-field-hover)'

const BTN_BASE =
  'display:inline-flex;align-items:center;justify-content:center;gap:5px;height:28px;padding:0 8px;border:1px solid transparent;border-radius:6px;background:transparent;color:inherit;cursor:pointer;font-size:13px;font-family:inherit;white-space:nowrap'

export const INPUT_CSS =
  'height:28px;box-sizing:border-box;padding:0 8px;border:1px solid var(--tq-field-border);border-radius:6px;background:var(--tq-field-bg);color:var(--tq-text);font-size:13px;font-family:inherit;outline:none;color-scheme:dark'

export const icon = (inner: string, size = 16): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" style="display:block" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none">${inner}</svg>`

export function button(
  html: string,
  title: string,
  onClick: () => void,
  o: { outline?: boolean; square?: boolean; primary?: boolean; css?: string } = {}
): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.title = title
  b.style.cssText =
    BTN_BASE +
    (o.square ? ';width:28px;padding:0' : '') +
    (o.outline ? ';border-color:var(--tq-field-border);background:var(--tq-field-bg)' : '') +
    (o.primary
      ? ';background:var(--tq-accent);border-color:var(--tq-accent);color:var(--tq-ink);font-weight:600'
      : '') +
    (o.css ? ';' + o.css : '')
  b.innerHTML = html
  b.addEventListener('mousedown', (e) => e.preventDefault())
  b.addEventListener('mouseenter', () => {
    if (o.primary) b.style.filter = 'brightness(1.1)'
    else if (b.dataset.on !== '1') {
      b.style.background = HOVER_BG
      if (o.outline) b.style.borderColor = 'var(--tq-field-border-hover)'
    }
  })
  b.addEventListener('mouseleave', () => {
    if (o.primary) b.style.filter = ''
    else if (b.dataset.on !== '1') {
      b.style.background = o.outline ? 'var(--tq-field-bg)' : 'transparent'
      if (o.outline) b.style.borderColor = 'var(--tq-field-border)'
    }
  })
  b.addEventListener('click', onClick)
  return b
}

export function setOn(b: HTMLElement | undefined, on: boolean): void {
  if (!b) return
  b.dataset.on = on ? '1' : '0'
  b.style.background = on ? ON_BG : 'transparent'
  b.style.color = on ? 'var(--tq-accent)' : 'inherit'
}

export function kbd(text: string): HTMLElement {
  const k = document.createElement('span')
  k.textContent = text
  k.style.cssText =
    'display:inline-block;min-width:18px;padding:1px 5px;margin:0 2px;text-align:center;font-size:11.5px;line-height:16px;color:var(--tq-text2);background:var(--tq-key-bg);border:1px solid var(--tq-key-border);border-bottom-width:2px;border-radius:4px'
  return k
}

export function hintLine(parts: (string | { key: string })[]): HTMLElement {
  const h = document.createElement('div')
  h.style.cssText = 'font-size:12.5px;color:var(--tq-text2);line-height:22px'
  for (const p of parts) h.append(typeof p === 'string' ? document.createTextNode(p) : kbd(p.key))
  return h
}

export const PALETTE = [
  '#000000',
  '#434343',
  '#666666',
  '#999999',
  '#b7b7b7',
  '#cccccc',
  '#d9d9d9',
  '#efefef',
  '#f3f3f3',
  '#ffffff',
  '#980000',
  '#ff0000',
  '#ff9900',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#4a86e8',
  '#0000ff',
  '#9900ff',
  '#ff00ff',
  '#e6b8af',
  '#f4cccc',
  '#fce5cd',
  '#fff2cc',
  '#d9ead3',
  '#d0e0e3',
  '#c9daf8',
  '#cfe2f3',
  '#d9d2e9',
  '#ead1dc',
  '#dd7e6b',
  '#ea9999',
  '#f9cb9c',
  '#ffe599',
  '#b6d7a8',
  '#a2c4c9',
  '#a4c2f4',
  '#9fc5e8',
  '#b4a7d6',
  '#d5a6bd',
  '#cc4125',
  '#e06666',
  '#f6b26b',
  '#ffd966',
  '#93c47d',
  '#76a5af',
  '#6d9eeb',
  '#6fa8dc',
  '#8e7cc3',
  '#c27ba0',
  '#a61c00',
  '#cc0000',
  '#e69138',
  '#f1c232',
  '#6aa84f',
  '#45818e',
  '#3c78d8',
  '#3d85c6',
  '#674ea7',
  '#a64d79',
  '#85200c',
  '#990000',
  '#b45f06',
  '#bf9000',
  '#38761d',
  '#134f5c',
  '#1155cc',
  '#0b5394',
  '#351c75',
  '#741b47',
  '#5b0f00',
  '#660000',
  '#783f04',
  '#7f6000',
  '#274e13',
  '#0c343d',
  '#1c4587',
  '#073763',
  '#20124d',
  '#4c1130'
]

export interface DropItem {
  text: string
  value: string | null
  css?: string
  swatch?: string
  html?: string
  title?: string
  sepBefore?: boolean
}

interface MenuRef {
  wrap: HTMLElement
  close: () => void
}
const menus = new Set<MenuRef>()
let hooked = false

export function closeMenus(): void {
  menus.forEach((m) => m.close())
}

export function registerMenu(wrap: HTMLElement, close: () => void): void {
  hookOutside()
  menus.add({ wrap, close })
}

function hookOutside(): void {
  if (hooked) return
  hooked = true
  document.addEventListener(
    'mousedown',
    (e) => {
      for (const m of Array.from(menus)) {
        if (!m.wrap.isConnected) {
          menus.delete(m)
          continue
        }
        if (!(e.target instanceof Node) || !m.wrap.contains(e.target)) m.close()
      }
    },
    true
  )
}

function anchorMenu(menu: HTMLElement, btn: HTMLElement): void {
  const r = btn.getBoundingClientRect()
  menu.style.left = `${r.left}px`
  menu.style.top = `${r.bottom + 3}px`
  menu.style.right = 'auto'
  menu.style.transform = ''
  const mr = menu.getBoundingClientRect()
  const vw = document.documentElement.clientWidth
  if (mr.right > vw - 4) menu.style.left = `${Math.max(4, vw - 4 - mr.width)}px`
  if (mr.bottom > window.innerHeight - 4) menu.style.top = `${Math.max(4, r.top - 3 - mr.height)}px`
}

export function dropdown(o: {
  label: string
  title: string
  width: number
  block?: boolean
  maxHeight?: number
  flat?: boolean
  icon?: string
  colorBar?: boolean
  palette?: string[]
  noneText?: string
  custom?: (menu: HTMLElement, close: () => void) => void
  items: () => DropItem[]
  pick: (v: string | null) => void
}): {
  wrap: HTMLElement
  set: (text: string, swatch?: string | null) => void
  setHtml: (html: string) => void
} {
  hookOutside()
  const wrap = document.createElement('div')
  wrap.style.cssText = o.block ? 'position:relative;width:100%' : 'position:relative'
  const b = document.createElement('button')
  b.type = 'button'
  b.title = o.title
  b.style.cssText =
    BTN_BASE +
    `;justify-content:space-between;${o.flat ? '' : 'border-color:var(--tq-field-border);background:var(--tq-field-bg);'}${o.block ? 'width:100%' : `min-width:${o.width}px`}`
  if (o.flat) {
    b.addEventListener('mouseenter', () => (b.style.background = HOVER_BG))
    b.addEventListener('mouseleave', () => (b.style.background = 'transparent'))
  }
  const dot = document.createElement('span')
  dot.style.cssText = `display:none;flex:none;width:12px;height:12px;border-radius:3px;border:${LINE}`
  const txt = document.createElement('span')
  txt.textContent = o.label
  txt.style.cssText = `flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;max-width:${o.width + 60}px`
  const caret = document.createElement('span')
  caret.textContent = '▾'
  caret.style.cssText = 'flex:none;font-size:15px;line-height:1;color:var(--tq-text3)'
  b.append(dot, txt, caret)
  const bar = document.createElement('i')
  if (o.icon) {
    dot.remove()
    caret.remove()
    b.style.minWidth = '0'
    b.style.padding = '0 6px'
    b.style.gap = '3px'
    b.style.justifyContent = 'center'
    txt.style.cssText =
      'display:inline-flex;flex-direction:column;align-items:center;gap:1px;line-height:1;max-width:none'
    txt.innerHTML = o.icon
    if (o.colorBar) {
      bar.style.cssText =
        'display:block;width:14px;height:3px;border-radius:1px;background:var(--tq-text3)'
      txt.appendChild(bar)
    }
  }

  const menu = document.createElement('div')
  menu.style.cssText = `display:none;position:fixed;left:0;top:0;z-index:10001;width:max-content;min-width:0;max-width:280px;max-height:${o.maxHeight ?? 240}px;overflow-y:auto;scrollbar-width:none;padding:4px;background:var(--tq-panel);color:var(--tq-text);border:${LINE};border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.45);box-sizing:border-box`
  const close = (): void => {
    menu.style.display = 'none'
  }
  menus.add({
    wrap: {
      contains: (n: Node) => wrap.contains(n) || menu.contains(n),
      isConnected: true
    } as unknown as HTMLElement,
    close
  })
  b.addEventListener('mousedown', (e) => e.preventDefault())
  b.addEventListener('click', () => {
    const open = menu.style.display !== 'none'
    closeMenus()
    if (open) return
    menu.replaceChildren()
    if (o.custom) {
      o.custom(menu, close)
      menu.style.maxHeight = 'none'
      menu.style.maxWidth = 'none'
      menu.style.display = 'block'
      anchorMenu(menu, b)
      return
    }
    if (o.palette) {
      const choose = (v: string | null): void => {
        close()
        if (o.colorBar) bar.style.background = v ?? 'var(--tq-text3)'
        o.pick(v)
      }
      if (o.noneText) {
        const none = document.createElement('div')
        none.textContent = o.noneText
        none.style.cssText =
          'padding:6px 10px;margin-bottom:4px;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:13px'
        none.addEventListener('mouseenter', () => (none.style.background = HOVER_BG))
        none.addEventListener('mouseleave', () => (none.style.background = ''))
        none.addEventListener('mousedown', (e) => e.preventDefault())
        none.addEventListener('click', () => choose(null))
        menu.appendChild(none)
      }
      const grid = document.createElement('div')
      grid.style.cssText =
        'display:grid;grid-template-columns:repeat(10,18px);gap:4px;padding:2px 4px 4px'
      for (const c of o.palette) {
        const sw = document.createElement('div')
        sw.title = c
        sw.style.cssText = `width:18px;height:18px;border-radius:50%;cursor:pointer;box-sizing:border-box;background:${c};border:1px solid rgba(128,128,128,.45)`
        sw.addEventListener('mouseenter', () => (sw.style.outline = '2px solid var(--tq-text2)'))
        sw.addEventListener('mouseleave', () => (sw.style.outline = ''))
        sw.addEventListener('mousedown', (e) => e.preventDefault())
        sw.addEventListener('click', () => choose(c))
        grid.appendChild(sw)
      }
      menu.appendChild(grid)
      menu.style.maxHeight = 'none'
      menu.style.maxWidth = 'none'
      menu.style.display = 'block'
      anchorMenu(menu, b)
      return
    }
    for (const it of o.items()) {
      if (it.sepBefore) {
        const sp = document.createElement('div')
        sp.style.cssText = 'height:1px;margin:4px 2px;background:var(--tq-divider)'
        menu.appendChild(sp)
      }
      const row = document.createElement('div')
      row.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:13px;${it.css ?? ''}`
      if (it.swatch) {
        const sw = document.createElement('span')
        sw.style.cssText = `width:14px;height:14px;border-radius:3px;border:${DIV};background:${it.swatch}`
        row.appendChild(sw)
      }
      if (it.html !== undefined) {
        const h = document.createElement('span')
        h.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%'
        h.innerHTML = it.html
        row.appendChild(h)
      } else row.appendChild(document.createTextNode(it.text))
      if (it.title) row.title = it.title
      row.addEventListener('mouseenter', () => (row.style.background = HOVER_BG))
      row.addEventListener('mouseleave', () => (row.style.background = ''))
      row.addEventListener('mousedown', (e) => e.preventDefault())
      row.addEventListener('click', () => {
        close()
        o.pick(it.value)
      })
      menu.appendChild(row)
    }
    menu.style.display = 'block'
    anchorMenu(menu, b)
  })
  wrap.append(b)
  document.body.appendChild(menu)
  return {
    wrap,
    setHtml: (html) => {
      dot.style.display = 'none'
      txt.style.display = 'flex'
      txt.style.alignItems = 'center'
      txt.style.gap = '10px'
      txt.innerHTML = html
    },
    set: (text, swatch) => {
      if (o.icon) {
        b.title = swatch ? `${o.title}: ${text}` : o.title
        if (o.colorBar) bar.style.background = swatch ?? 'var(--tq-text3)'
        return
      }
      txt.style.display = ''
      txt.textContent = text
      dot.style.display = swatch ? 'block' : 'none'
      if (swatch) dot.style.background = swatch
    }
  }
}

export function panel(o: { title: string; top?: string; onClose: () => void }): {
  box: HTMLElement
  body: HTMLElement
  foot: HTMLElement
  close: () => void
} {
  const box = document.createElement('div')
  box.style.cssText = `position:fixed;left:50%;top:${o.top ?? '12%'};transform:translateX(-50%);z-index:9999;background:var(--tq-panel);color:var(--tq-text);border:${LINE};border-radius:10px;box-shadow:0 14px 40px rgba(0,0,0,.5);font-size:13px;font-family:inherit;user-select:none;min-width:240px`
  const head = document.createElement('div')
  head.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 8px 8px 14px;border-bottom:${DIV};cursor:move`
  const t = document.createElement('span')
  t.textContent = o.title
  t.style.cssText = 'font-weight:600;font-size:13px'
  const x = button(icon('<path d="M4 4l8 8M12 4l-8 8"/>', 14), '닫기', o.onClose, {
    square: true,
    css: 'width:24px;height:24px'
  })
  head.append(t, x)
  const body = document.createElement('div')
  body.style.cssText = 'padding:14px'
  const foot = document.createElement('div')
  foot.style.cssText = `padding:8px 14px;border-top:${DIV}`
  box.append(head, body, foot)

  head.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest('button'))) return
    e.preventDefault()
    const r = box.getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    box.style.transform = 'none'
    box.style.left = `${r.left}px`
    box.style.top = `${r.top}px`
    const move = (ev: MouseEvent): void => {
      box.style.left = `${Math.max(0, Math.min(window.innerWidth - 60, ev.clientX - dx))}px`
      box.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy))}px`
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  })
  return { box, body, foot, close: () => box.remove() }
}

export function field(label: string, control: HTMLElement): HTMLElement {
  const w = document.createElement('div')
  w.style.cssText = 'display:flex;flex-direction:column;gap:4px'
  const t = document.createElement('span')
  t.textContent = label
  t.style.cssText = 'font-size:12px;color:var(--tq-text2)'
  w.append(t, control)
  return w
}

let toastEl: HTMLElement | null = null
export function toast(msg: string): void {
  toastEl?.remove()
  const d = document.createElement('div')
  d.textContent = msg
  d.style.cssText = `position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:10002;max-width:80vw;padding:9px 16px;background:var(--tq-toast-bg);color:var(--tq-text);border:${LINE};border-left:3px solid var(--tq-danger);border-radius:8px;box-shadow:0 10px 28px rgba(0,0,0,.45);font-size:13px;line-height:1.5;font-family:inherit;opacity:0;transition:opacity .15s`
  document.body.appendChild(d)
  toastEl = d
  requestAnimationFrame(() => (d.style.opacity = '1'))
  window.setTimeout(() => {
    d.style.opacity = '0'
    window.setTimeout(() => {
      d.remove()
      if (toastEl === d) toastEl = null
    }, 160)
  }, 2800)
}

export function lineSample(kind: string, px = 1.5, width: number | 'full' = 84): string {
  if (kind === 'none') return `<span style="color:var(--tq-text2)">없음</span>`
  const full = width === 'full'
  const w = full ? '100%' : String(width)
  const x1 = full ? '0' : '2'
  const x2 = full ? '100%' : String((width as number) - 2)
  const svg = (inner: string): string =>
    `<svg width="${w}" height="14" style="display:block;${full ? 'flex:1;min-width:0' : 'flex:none'}" stroke="currentColor" fill="none">${inner}</svg>`
  const l = (y: number, sw: number, dash = ''): string =>
    `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke-width="${sw}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`
  if (kind === 'dashed') return svg(l(7, px, `${Math.max(4, px * 3)} ${Math.max(3, px * 2)}`))
  if (kind === 'double') return svg(l(4.5, Math.max(1, px / 2.5)) + l(9.5, Math.max(1, px / 2.5)))
  return svg(l(7, px))
}

export function diagSample(dir: 'down' | 'up'): string {
  return (
    `<svg width="100%" height="14" style="display:block;flex:1;min-width:0" fill="none" stroke="currentColor">` +
    `<rect x="1" y="1" height="12" style="width:calc(100% - 2px)" stroke-opacity=".4" stroke-dasharray="2 2"/>` +
    (dir === 'down'
      ? '<line x1="1" y1="1" x2="99%" y2="13" stroke-width="1.6"/>'
      : '<line x1="1" y1="13" x2="99%" y2="1" stroke-width="1.6"/>') +
    `</svg>`
  )
}

export function colorBar(color: string | null, width: number | 'full' = 84): string {
  const c = color ? `var(--c-${color})` : '#000'
  const w = width === 'full' ? 'flex:1;min-width:0' : `flex:none;width:${width}px`
  return `<span style="display:block;${w};height:12px;border-radius:2px;border:${DIV};background:${c}"></span>`
}
