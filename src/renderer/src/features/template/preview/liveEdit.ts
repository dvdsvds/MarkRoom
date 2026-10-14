let active = false
const subs = new Set<() => void>()

export function setLiveEdit(on: boolean): void {
  if (active === on) return
  active = on
  for (const f of subs) f()
}

export function subscribeLiveEdit(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

export function getLiveEdit(): boolean {
  return active
}