import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { markdownRenderer } from '../markdown/renderMarkdown'
import { useCodeRun } from './preview/useCodeRun'
import { useImageMinWidth } from './preview/useImageMinWidth'
import { useScrollSync } from './preview/useScrollSync'
import { useClickHandlers } from './preview/useClickHandlers'
import { useMermaid } from './preview/useMermaid'
import { useCodeDecorations } from './preview/useCodeDecorations'
import { useOutputBlocks } from './preview/useOutputBlocks'
import { useTemplateRender } from './preview/useTemplateRender'
import { useTemplateEdit } from './preview/useTemplateEdit'

export interface MarkdownPreviewHandle {
  scrollToRatio: (ratio: number) => void
}

interface MarkdownPreviewProps {
  source: string
  baseDir?: string
  onScrollRatio?: (ratio: number) => void
  onWikilinkClick?: (title: string) => void
  onToggleTask?: (line: number) => void
  onReplaceSource?: (next: string) => void
  onMinWidthChange?: (px: number) => void
  onHasTemplateChange?: (has: boolean) => void
  className?: string
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview(
    {
      source,
      baseDir,
      onScrollRatio,
      onWikilinkClick,
      onToggleTask,
      onReplaceSource,
      onMinWidthChange,
      onHasTemplateChange,
      className
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const onReplaceSourceRef = useRef(onReplaceSource)
    const sourceRef = useRef(source)
    const editIdxRef = useRef<number | null>(null)
    const editModeRef = useRef(false)

    useEffect(() => {
      onReplaceSourceRef.current = onReplaceSource
      sourceRef.current = source
    })

    const html = useMemo(() => markdownRenderer.render(source, baseDir), [source, baseDir])
    useImageMinWidth(containerRef, html, onMinWidthChange)
    useScrollSync(containerRef, ref, onScrollRatio)
    useClickHandlers(containerRef, onWikilinkClick, onToggleTask)

    const onHasTemplateChangeRef = useRef(onHasTemplateChange)

    useEffect(() => {
      onHasTemplateChangeRef.current = onHasTemplateChange
    }, [onHasTemplateChange])

    useEffect(() => {
      onHasTemplateChangeRef.current?.(html.includes('snote-template'))
    }, [html])

    useMermaid(containerRef, html)
    useCodeDecorations(containerRef, html)
    useOutputBlocks(containerRef, html)
    useTemplateRender(containerRef, html, editIdxRef, editModeRef)
    useCodeRun(containerRef, html, baseDir, sourceRef, onReplaceSourceRef)
    useTemplateEdit(containerRef, editIdxRef, editModeRef)

    return (
      <div
        ref={containerRef}
        className={`prose-preview ${className ?? ''}`}
        style={{
          fontFamily: 'var(--font-preview)',
          fontSize: 'var(--preview-font-size)',
          lineHeight: 'var(--preview-line-height)'
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
)