import { applyGridEdit } from '../../editor/templateEdit'
import {
  setBorders,
  setDiagonals,
  type GridInfo,
  type GridResult,
  type Rect
} from '../gridEdit'
import { openBorderPanel, type BorderState } from '../templatePanels'
import { readEdges } from '../templateRead'
import { toast } from '../uiKit'
import type { GridSelection } from './gridSelection'

export function createBorderPanel(opts: { gs: GridSelection }): {
  isOpen: () => boolean
  toggle: () => void
  close: () => void
  refresh: () => void
} {
  const { gs } = opts
  const bs: BorderState = { kind: 'solid', w: null, c: null }
  let panel: ReturnType<typeof openBorderPanel> | null = null

  const close = (): void => {
    panel?.box.remove()
    panel = null
  }

  const refresh = (): void => {
    if (!panel) return
    const g = gs.gridEl()
    const sel = gs.state.sel
    panel.setEdges(g && sel ? readEdges(g, gs.normalize(sel)) : {})
  }

  const run = (
    fn: (info: GridInfo, rect: Rect, getLine: (n: number) => string) => GridResult
  ): boolean => {
    const info = gs.gridInfo()
    const sel = gs.state.sel
    if (!info || !sel) {
      toast('칸을 먼저 선택해 주세요')
      return false
    }
    const rect: Rect = gs.normalize(sel)
    const err = applyGridEdit((getLine) => fn(info, rect, getLine))
    if (err) toast(err)
    return !err
  }

  const toggle = (): void => {
    if (panel) {
      close()
      return
    }
    panel = openBorderPanel({
      st: bs,
      borders: (where) => run((i, r, g) => setBorders(i, r, where, { ...bs }, g)),
      diagonal: (dir) => run((i, r, g) => setDiagonals(i, r, dir, { ...bs }, g)),
      onClose: close
    })
    refresh()
  }

  return { isOpen: () => panel !== null, toggle, close, refresh }
}

export type BorderPanel = ReturnType<typeof createBorderPanel>