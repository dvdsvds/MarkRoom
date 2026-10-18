export interface SimNode {
  x: number
  y: number
  vx: number
  vy: number
  fixed: boolean
}

export interface SimLink {
  source: number
  target: number
}

const REPULSION = 500
const REPULSION_CUTOFF_SQ = 400 * 400
const LINK_DISTANCE = 40
const LINK_STRENGTH = 0.06
const CENTER_STRENGTH = 0.04
const VELOCITY_DECAY = 0.6

export const ALPHA_MIN = 0.005
export const ALPHA_DECAY = 0.977

export function createNodes(count: number): SimNode[] {
  const nodes: SimNode[] = []
  for (let i = 0; i < count; i++) {
    const r = 12 * Math.sqrt(i + 0.5)
    const angle = i * 2.399963
    nodes.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), vx: 0, vy: 0, fixed: false })
  }
  return nodes
}

export function tick(nodes: SimNode[], links: SimLink[], alpha: number): void {
  const n = nodes.length
  for (let i = 0; i < n; i++) {
    const a = nodes[i]
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j]
      let dx = a.x - b.x
      let dy = a.y - b.y
      let d2 = dx * dx + dy * dy
      if (d2 > REPULSION_CUTOFF_SQ) continue
      if (d2 < 1) {
        dx = Math.random() - 0.5
        dy = Math.random() - 0.5
        d2 = 1
      }
      const f = (REPULSION * alpha) / d2
      a.vx += dx * f
      a.vy += dy * f
      b.vx -= dx * f
      b.vy -= dy * f
    }
  }

  for (const link of links) {
    const s = nodes[link.source]
    const t = nodes[link.target]
    const dx = t.x - s.x
    const dy = t.y - s.y
    const d = Math.sqrt(dx * dx + dy * dy) || 1
    const k = ((d - LINK_DISTANCE) / d) * LINK_STRENGTH * alpha
    s.vx += dx * k
    s.vy += dy * k
    t.vx -= dx * k
    t.vy -= dy * k
  }

  for (const node of nodes) {
    if (node.fixed) {
      node.vx = 0
      node.vy = 0
      continue
    }
    node.vx -= node.x * CENTER_STRENGTH * alpha
    node.vy -= node.y * CENTER_STRENGTH * alpha
    node.vx *= VELOCITY_DECAY
    node.vy *= VELOCITY_DECAY
    node.x += node.vx
    node.y += node.vy
  }
}
