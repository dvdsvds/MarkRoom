import { useEffect, type RefObject } from 'react'
import playIcon from '../../icons/tb-play.svg?raw'
import { runPython } from '@renderer/python/pyRunner'
import { applyResult, blockToText, outputToText } from '../../markdown/resultText'
import { applyValues } from '../../markdown/valueBlock'
import { renderBlocks } from '../outputBlocks'

export function useCodeRun(
  containerRef: RefObject<HTMLDivElement | null>,
  html: string,
  baseDir: string | undefined,
  sourceRef: RefObject<string>,
  onReplaceSourceRef: RefObject<((next: string) => void) | undefined>
): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const blocks = Array.from(
      el.querySelectorAll<HTMLElement>(
        'pre > code.language-js, pre > code.language-javascript, pre > code.language-python, pre > code.language-py'
      )
    )
    const cleanups: (() => void)[] = []
    for (const code of blocks) {
      const pre = code.parentElement
      if (!pre) continue
      const box = document.createElement('div')
      box.className = 'code-run'
      const bar = document.createElement('div')
      bar.className = 'code-run-bar'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'code-run-btn run'
      const setRunLabel = (label: string): void => {
        button.innerHTML = `${playIcon.trim()}<span></span>`
        const span = button.querySelector('span')
        if (span) span.textContent = label
      }
      setRunLabel('실행')
      bar.append(button)

      const startLine = Number(code.dataset.line)
      const endLine = Number(code.dataset.end)
      const canSave = Number.isInteger(startLine) && Number.isInteger(endLine) && endLine > startLine
      const saveBtn = canSave ? document.createElement('button') : null
      if (saveBtn) {
        saveBtn.type = 'button'
        saveBtn.className = 'code-run-btn'
        saveBtn.textContent = '저장'
        saveBtn.disabled = true
        bar.append(saveBtn)
      }

      const out = document.createElement('pre')
      out.className = 'code-run-out'
      out.hidden = true
      const blocksBox = document.createElement('div')
      blocksBox.className = 'code-run-blocks'
      box.append(bar, blocksBox, out)
      pre.after(box)

      const codeText = code.textContent ?? ''
      const isPython = /\blanguage-(python|py)\b/.test(code.className)
      let saved: string[][] | null = null

      let pendingValues: Record<string, string> = {}
      const valueBtn = document.createElement('button')
      valueBtn.type = 'button'
      valueBtn.className = 'code-run-btn'
      valueBtn.textContent = '값 적용'
      valueBtn.hidden = true
      bar.append(valueBtn)

      const onClick = async (): Promise<void> => {
        button.disabled = true
        setRunLabel(isPython ? '실행 중… (처음엔 몇 초 걸려요)' : '실행 중…')
        if (saveBtn) saveBtn.disabled = true
        const r = isPython
          ? await runPython(codeText, baseDir ?? '')
          : await window.api.code.run(codeText, baseDir ?? '')
        const lines: string[] = []
        if (r.output) lines.push(r.output)
        if (r.result !== null) lines.push(`→ ${r.result}`)
        if (r.error) lines.push(r.error)
        const hasBlocks = r.blocks.length > 0
        out.textContent = lines.join('\n') || (hasBlocks ? '' : '(출력 없음)')
        out.classList.toggle('error', Boolean(r.error))
        out.hidden = lines.length === 0 && hasBlocks
        blocksBox.replaceChildren(...renderBlocks(r.blocks))
        button.disabled = false
        setRunLabel('다시 실행')
        pendingValues = r.error ? {} : (r.values ?? {})
        const n = Object.keys(pendingValues).length
        valueBtn.hidden = n === 0
        valueBtn.textContent = `값 적용 (${n})`
        valueBtn.disabled = false

        const textLines: string[] = []
        if (r.output) textLines.push(r.output)
        if (r.result !== null) textLines.push(`→ ${r.result}`)
        const parts = r.blocks.map((b) => blockToText(b))
        if (textLines.length > 0) parts.push(outputToText(textLines.join('\n')))
        saved = r.error || parts.length === 0 ? null : parts
        if (saveBtn) {
          saveBtn.disabled = saved === null
          saveBtn.textContent = '저장'
        }
      }

      const onSave = (): void => {
        if (!saveBtn || !saved) return
        const next = applyResult(sourceRef.current, startLine, endLine, saved)
        if (next === null) {
          saveBtn.textContent = '위치를 못 찾았어요'
          return
        }
        onReplaceSourceRef.current?.(next)
      }

      const onApplyValues = (): void => {
        const next = applyValues(sourceRef.current, pendingValues)
        if (next === null) {
          valueBtn.textContent = 'template을 못 찾았어요'
          return
        }
        onReplaceSourceRef.current?.(next)
      }

      button.addEventListener('click', onClick)
      saveBtn?.addEventListener('click', onSave)
      valueBtn.addEventListener('click', onApplyValues)
      cleanups.push(() => {
        button.removeEventListener('click', onClick)
        saveBtn?.removeEventListener('click', onSave)
        valueBtn.removeEventListener('click', onApplyValues)
        box.remove()
      })
    }
    return () => {
      for (const c of cleanups) c()
    }
  }, [containerRef, html, baseDir, sourceRef, onReplaceSourceRef])
}