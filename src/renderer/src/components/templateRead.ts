/** 그려진 격자(.tq-grid)에서 선택한 칸 범위의 현재 테두리를 읽는다. 그리기 쪽이 붙여 둔 data-* 값을 쓴다. */

export interface EdgeVal {
  kind: string
  w: number | null
  c: string | null
}
export type PvKey = 'left' | 'right' | 'top' | 'bottom' | 'vmid' | 'hmid' | 'dd' | 'du'
/** 값이 없으면 선이 없는 것, 'mixed'는 칸마다 달라서 하나로 말할 수 없다는 뜻 */
export type EdgeRead = Partial<Record<PvKey, EdgeVal | 'mixed' | null>>

interface Piece {
  o: 'v' | 'h'
  b: number
  a1: number
  a2: number
  val: EdgeVal
}

const same = (a: EdgeVal, b: EdgeVal): boolean => a.kind === b.kind && a.w === b.w && a.c === b.c

function combine(list: (EdgeVal | null)[]): EdgeVal | 'mixed' | null {
  if (list.length === 0) return null
  const first = list[0]
  for (const x of list) {
    if ((x === null) !== (first === null)) return 'mixed'
    if (x !== null && first !== null && !same(x, first)) return 'mixed'
  }
  return first
}

const parseDiag = (s: string | undefined): EdgeVal | null => {
  if (!s) return null
  const [kind, w, c] = s.split(',')
  return { kind, w: w === '' || w === undefined ? null : Number(w), c: c === '' || c === undefined ? null : c }
}

export function readEdges(
  grid: HTMLElement,
  rect: { r1: number; c1: number; r2: number; c2: number }
): EdgeRead {
  const cols = Number(grid.dataset.cols)
  const rows = (JSON.parse(grid.dataset.heights ?? '[]') as number[]).length
  const pieces: Piece[] = []
  for (const e of Array.from(grid.querySelectorAll<HTMLElement>('.tq-edge[data-o]'))) {
    pieces.push({
      o: e.dataset.o as 'v' | 'h',
      b: Number(e.dataset.b),
      a1: Number(e.dataset.a1),
      a2: Number(e.dataset.a2),
      val: {
        kind: e.dataset.kind ?? 'solid',
        w: e.dataset.w ? Number(e.dataset.w) : null,
        c: e.dataset.c ? e.dataset.c : null
      }
    })
  }
  const frame: EdgeVal = {
    kind: grid.dataset.frame ?? 'solid',
    w: grid.dataset.frameW ? Number(grid.dataset.frameW) : null,
    c: grid.dataset.frameC ? grid.dataset.frameC : null
  }

  const at = (o: 'v' | 'h', b: number, a: number): EdgeVal | null => {
    let hit: EdgeVal | null = null
    for (const p of pieces) if (p.o === o && p.b === b && p.a1 <= a && a <= p.a2) hit = p.val
    if (hit) return hit
    const edge = o === 'v' ? b === 0 || b === cols : b === 0 || b === rows
    return edge ? frame : null
  }
  const vs = (bs: number[]): (EdgeVal | null)[] => {
    const out: (EdgeVal | null)[] = []
    for (const b of bs) for (let r = rect.r1; r <= rect.r2; r++) out.push(at('v', b, r))
    return out
  }
  const hs = (bs: number[]): (EdgeVal | null)[] => {
    const out: (EdgeVal | null)[] = []
    for (const b of bs) for (let c = rect.c1; c <= rect.c2; c++) out.push(at('h', b, c))
    return out
  }
  const range = (a: number, b: number): number[] => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i)
  const cells = Array.from(grid.querySelectorAll<HTMLElement>('.tq-cell')).filter((x) => {
    const r = Number(x.dataset.r), c = Number(x.dataset.c)
    const rs = Number(x.dataset.rs), cs = Number(x.dataset.cs)
    return r + rs > rect.r1 && r <= rect.r2 && c + cs > rect.c1 && c <= rect.c2
  })
  return {
    left: combine(vs([rect.c1])),
    right: combine(vs([rect.c2 + 1])),
    top: combine(hs([rect.r1])),
    bottom: combine(hs([rect.r2 + 1])),
    vmid: combine(vs(range(rect.c1 + 1, rect.c2))),
    hmid: combine(hs(range(rect.r1 + 1, rect.r2))),
    dd: combine(cells.map((x) => parseDiag(x.dataset.dd))),
    du: combine(cells.map((x) => parseDiag(x.dataset.du)))
  }
}