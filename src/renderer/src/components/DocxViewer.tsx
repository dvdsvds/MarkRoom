import { useEffect, useRef, useState } from 'react'
import { OfficeViewerFrame } from './OfficeViewerFrame'
import { loadFileBytes } from '../utils/loadFileBytes'

export function DocxViewer({ filePath }: { filePath: string }): React.JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const body = bodyRef.current
    const styles = styleRef.current
    if (!body || !styles) return
    void (async () => {
      try {
        const [{ renderAsync }, data] = await Promise.all([
          import('docx-preview'),
          loadFileBytes(filePath)
        ])
        if (cancelled) return
        body.replaceChildren()
        styles.replaceChildren()
        await renderAsync(data, body, styles, {
          className: 'docx',
          inWrapper: true,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          // CSP가 blob: 이미지를 막아서 data: 주소로 넣는다
          useBase64URL: true
        })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filePath])

  // 문서 안 링크는 앱 안에서 이동하지 않게 막고, 웹 주소만 외부 브라우저로 연다
  const handleClick = (e: React.MouseEvent): void => {
    const anchor = (e.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href') ?? ''
    if (href.startsWith('#')) return
    e.preventDefault()
    if (/^https?:\/\//.test(href)) window.open(href)
  }

  return (
    <OfficeViewerFrame filePath={filePath} error={error} loading={loading}>
      <div ref={styleRef} className="hidden" />
      <div
        ref={bodyRef}
        onClick={handleClick}
        className="docx-viewer h-full overflow-auto"
        style={{ visibility: loading ? 'hidden' : 'visible' }}
      />
    </OfficeViewerFrame>
  )
}
