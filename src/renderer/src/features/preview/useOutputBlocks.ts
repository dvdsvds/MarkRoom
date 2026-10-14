import { useEffect, type RefObject } from 'react'
import type { ParsedBlock } from '../../markdown/blockPlugin'
import { renderBlocks } from '../../utils/outputBlocks'

export function useOutputBlocks(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string
): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    for (const node of Array.from(el.querySelectorAll<HTMLElement>('div.snote-block'))) {
      let parsed: ParsedBlock
      try {
        parsed = JSON.parse(node.dataset.spec ?? '') as ParsedBlock
      } catch {
        parsed = { error: '블록을 읽을 수 없어요.' }
      }
      if ('error' in parsed) {
        const e = document.createElement('div')
        e.className = 'code-run-out error'
        e.textContent = parsed.error
        node.replaceChildren(e)
      } else {
        node.replaceChildren(...renderBlocks([parsed.block]))
      }
    }
  }, [containerRef, html])
}