import type { OutputBlock } from '../../../utils/outputBlocks'

export type Align = 'left' | 'center' | 'right' | 'justify' | 'distribute'
export type VAlign = 'top' | 'middle' | 'bottom'
export type LineKind = 'solid' | 'thick' | 'double' | 'dashed'
export type EdgeKind = 'none' | LineKind
export type FrameKind = 'none' | LineKind
export type Sides = { l: boolean; t: boolean; r: boolean; b: boolean }
export type Edges = { l: EdgeKind; t: EdgeKind; r: EdgeKind; b: EdgeKind }
export type EdgeExtra = { w: number | null; c: string | null }
export type Diag = { kind: LineKind; w: number | null; c: string | null }
export type Style = {
  ff: string | null
  fs: number
  ls: number | null
  lh: number | null
  fc: string | null
  bg: string | null
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  align: Align
  valign: VAlign
  vertical: boolean
  p: number | null
  edges: Edges
  ec: string | null
  set: Partial<Edges>
  ex: Partial<Record<keyof Edges, EdgeExtra>>
  dd: Diag | null
  du: Diag | null
}
export type GridCell = {
  r: number
  c: number
  cs: number
  rs: number
  style: Style
  text: string
  raw: string
  src: { def: number; end: number } | null
  ord: number
  gridEnd: number | null
}
export type TNode =
  | { k: 'block'; block: OutputBlock }
  | { k: 'line'; kind: LineKind }
  | { k: 'space'; n: number }
  | { k: 'text'; text: string; style: Style; line: number | null; raw: string }
  | { k: 'box'; children: TNode[] }
  | { k: 'table'; columns: string[]; rows: string[][] }
  | {
      k: 'grid'
      cols: number
      frame: FrameKind
      widths: (number | null)[]
      heights: number[]
      cells: GridCell[]
      frameW: number | null
      frameC: string | null
      endLine: number | null
      head: number
      close: number | null
    }
export type ParsedTemplate =
  | { page: Style; nodes: TNode[]; warnings: string[]; close: number }
  | { error: string }

export type Opt = Partial<Omit<Style, 'edges'>> & {
  h?: number
  border?: Sides
  line?: LineKind
  sides?: Partial<Edges>
  sideEx?: Partial<Record<keyof Edges, EdgeExtra>>
}
export type Scope = 'page' | 'cell' | 'text'