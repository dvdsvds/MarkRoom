import { useEffect, useRef, useState } from 'react'
import { useAppliedTheme } from '../stores/useAppliedTheme'
import { useAppliedFonts } from '../stores/useAppliedFonts'

export default function QuickCapture(): React.JSX.Element {
  useAppliedTheme()
  useAppliedFonts()
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingSubmit = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    return window.api.quick.onShown(() => {
      setText('')
      pendingSubmit.current = false
      inputRef.current?.focus()
    })
  }, [])

  const submit = (value: string): void => {
    const trimmed = value.trim()
    if (!trimmed) {
      void window.api.quick.hide()
      return
    }
    setText('')
    void window.api.quick.submit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      void window.api.quick.hide()
      return
    }
    const isEnter = e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter'
    if (!isEnter) return
    e.preventDefault()
    if (e.nativeEvent.isComposing) pendingSubmit.current = true
    else submit(e.currentTarget.value)
  }

  const handleCompositionEnd = (): void => {
    if (!pendingSubmit.current) return
    pendingSubmit.current = false
    setTimeout(() => submit(inputRef.current?.value ?? ''), 0)
  }

  return (
    <div className="flex h-screen flex-col justify-center gap-2 border border-border-strong bg-bg px-4">
      <div className="text-xs font-semibold text-text-secondary">퀵캡처 → Inbox</div>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionEnd={handleCompositionEnd}
        placeholder="떠오른 생각을 적고 Enter"
        className="w-full rounded-md border border-border bg-bg-soft px-3 py-2 text-[15px] text-text outline-none placeholder:text-text-tertiary focus:border-accent"
        spellCheck={false}
        autoFocus
      />
      <div className="text-[11px] text-text-tertiary">Enter 저장 · Esc 닫기</div>
    </div>
  )
}