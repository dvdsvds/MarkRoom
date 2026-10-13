import type { GridInfo } from '../gridEdit'

export type Sel = { r1: number; c1: number; r2: number; c2: number }
export type Pt = { r: number; c: number }
export type CellPos = { r: number; c: number; rs: number; cs: number }

export type GridSelectionState = {
  sel: Sel | null
  anchor: Pt | null
  head: Pt | null
  gridIdx: number | null
}

export function rcOf(c: HTMLElement): CellPos {
  return {
    r: Number(c.dataset.r),
    c: Number(c.dataset.c),
    rs: Number(c.dataset.rs),
    cs: Number(c.dataset.cs)
  }
}

export function whole(x: HTMLElement): Sel {
  const p = rcOf(x)
  return { r1: p.r, c1: p.c, r2: p.r + p.rs - 1, c2: p.c + p.cs - 1 }
}

export function createGridSelection(opts: {
  el: HTMLElement
  grid: () => HTMLElement | null
  onPaint: () => void
}): {
  state: GridSelectionState
  gridEl: () => HTMLElement | null
  cells: () => HTMLElement[]
  pickGrid: (x: HTMLElement) => void
  cellAt: (r: number, c: number) => HTMLElement | null
  size: () => { rows: number; cols: number }
  paint: () => void
  normalize: (s: Sel) => Sel
  select: (s: Sel | null, a?: Pt, h?: Pt) => void
  gridInfo: () => GridInfo | null
  f5: { whole: boolean }
} {
  const { el, grid, onPaint } = opts
  const state: GridSelectionState = { sel: null, anchor: null, head: null, gridIdx: null }
  const f5 = { whole: false }

  const gridEl = (): HTMLElement | null => {
    const g = grid()
    if (!g || state.gridIdx === null) return null
    return Array.from(g.querySelectorAll<HTMLElement>('.tq-grid'))[state.gridIdx] ?? null
  }
  const cells = (): HTMLElement[] =>
    Array.from(gridEl()?.querySelectorAll<HTMLElement>('.tq-cell') ?? [])

  const cellAt = (r: number, c: number): HTMLElement | null => {
    for (const x of cells()) {
      const p = rcOf(x)
      if (r >= p.r && r < p.r + p.rs && c >= p.c && c < p.c + p.cs) return x
    }
    return null
  }
  const size = (): { rows: number; cols: number } => {
    let rows = 0
    let cols = 0
    for (const x of cells()) {
      const p = rcOf(x)
      rows = Math.max(rows, p.r + p.rs)
      cols = Math.max(cols, p.c + p.cs)
    }
    return { rows, cols }
  }
  const paint = (): void => {
    for (const n of Array.from(el.querySelectorAll('.tq-selected')))
      n.classList.remove('tq-selected')
    onPaint()
    el.dispatchEvent(new Event('snote-editmode'))
    const sel = state.sel
    if (!sel) return
    for (const x of cells()) {
      const p = rcOf(x)
      if (p.r + p.rs > sel.r1 && p.r <= sel.r2 && p.c + p.cs > sel.c1 && p.c <= sel.c2) {
        x.classList.add('tq-selected')
      }
    }
  }
  const normalize = (s: Sel): Sel => {
    let { r1, c1, r2, c2 } = s
    for (let again = true; again; ) {
      again = false
      for (const x of cells()) {
        const p = rcOf(x)
        if (p.r + p.rs > r1 && p.r <= r2 && p.c + p.cs > c1 && p.c <= c2) {
          if (p.r < r1) ((r1 = p.r), (again = true))
          if (p.c < c1) ((c1 = p.c), (again = true))
          if (p.r + p.rs - 1 > r2) ((r2 = p.r + p.rs - 1), (again = true))
          if (p.c + p.cs - 1 > c2) ((c2 = p.c + p.cs - 1), (again = true))
        }
      }
    }
    return { r1, c1, r2, c2 }
  }
  const select = (s: Sel | null, a?: Pt, h?: Pt): void => {
    f5.whole = false
    state.sel = s ? normalize(s) : null
    if (!state.sel) {
      state.anchor = null
      state.head = null
    } else {
      state.anchor = a ?? { r: state.sel.r1, c: state.sel.c1 }
      state.head = h ?? { r: state.sel.r2, c: state.sel.c2 }
    }
    paint()
  }
  const pickGrid = (x: HTMLElement): void => {
    const g = grid()
    const tg = x.closest<HTMLElement>('.tq-grid')
    if (!g || !tg) return
    const before = state.gridIdx
    state.gridIdx = Array.from(g.querySelectorAll('.tq-grid')).indexOf(tg)
    if (state.gridIdx !== before) {
      state.sel = null
      state.anchor = null
      state.head = null
      paint()
    }
  }

  const gridInfo = (): GridInfo | null => {
    const g = gridEl()
    if (!g || g.dataset.head === undefined || g.dataset.close === undefined) return null
    try {
      return {
        head: Number(g.dataset.head),
        close: Number(g.dataset.close),
        cols: Number(g.dataset.cols),
        widths: JSON.parse(g.dataset.widths ?? '[]') as (number | null)[],
        heights: JSON.parse(g.dataset.heights ?? '[]') as number[],
        cells: cells().map((x) => ({
          ...rcOf(x),
          def: x.dataset.def !== undefined ? Number(x.dataset.def) : null,
          end: x.dataset.end !== undefined ? Number(x.dataset.end) : null
        }))
      }
    } catch {
      return null
    }
  }

  return { state, gridEl, cells, pickGrid, cellAt, size, paint, normalize, select, f5, gridInfo }
}

export type GridSelection = ReturnType<typeof createGridSelection>