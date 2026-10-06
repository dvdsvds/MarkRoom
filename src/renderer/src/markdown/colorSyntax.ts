export const COLOR_NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'] as const
export const HEX_PATTERN = '#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})'

const HEX_RE = new RegExp(`^${HEX_PATTERN}$`)

export type ColorSpec = {
  fg: string | null
  bg: string | null
}

function isColor(c: string): boolean {
  return (COLOR_NAMES as readonly string[]).includes(c) || HEX_RE.test(c)
}

export function parseColorHead(head: string): ColorSpec | null {
  let fg: string | null = null
  let bg: string | null = null
  for (const raw of head.split(',')) {
    let part = raw.trim()
    const isBg = part.startsWith('bg:')
    if (isBg) part = part.slice(3).trim()
    if (!isColor(part)) return null
    if (isBg) {
      if (bg !== null) return null
      bg = part
    } else {
      if (fg !== null) return null
      fg = part
    }
  }
  return fg === null && bg === null ? null : { fg, bg }
}