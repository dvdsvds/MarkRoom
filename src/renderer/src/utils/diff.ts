export type DiffLineType = 'same' | 'add' | 'remove'

interface DiffLine {
  type: DiffLineType
  text: string
}

const MAX_CELLS = 4_000_000

function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const n = a.length
  const m = b.length

  if (n * m > MAX_CELLS) {
    return [
      ...a.map((text): DiffLine => ({ type: 'remove', text })),
      ...b.map((text): DiffLine => ({ type: 'add', text }))
    ]
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const result: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'remove', text: a[i] })
      i++
    } else {
      result.push({ type: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) {
    result.push({ type: 'remove', text: a[i] })
    i++
  }
  while (j < m) {
    result.push({ type: 'add', text: b[j] })
    j++
  }
  return result
}

export interface DiffRow {
  left: string | null
  right: string | null
  leftType: 'same' | 'remove' | 'empty'
  rightType: 'same' | 'add' | 'empty'
}

export function diffToRows(oldText: string, newText: string): DiffRow[] {
  const lines = diffLines(oldText, newText)
  const rows: DiffRow[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.type === 'same') {
      rows.push({ left: line.text, right: line.text, leftType: 'same', rightType: 'same' })
      i++
      continue
    }
    const removes: string[] = []
    while (i < lines.length && lines[i].type === 'remove') {
      removes.push(lines[i].text)
      i++
    }
    const adds: string[] = []
    while (i < lines.length && lines[i].type === 'add') {
      adds.push(lines[i].text)
      i++
    }
    const max = Math.max(removes.length, adds.length)
    for (let k = 0; k < max; k++) {
      rows.push({
        left: k < removes.length ? removes[k] : null,
        right: k < adds.length ? adds[k] : null,
        leftType: k < removes.length ? 'remove' : 'empty',
        rightType: k < adds.length ? 'add' : 'empty'
      })
    }
  }
  return rows
}
