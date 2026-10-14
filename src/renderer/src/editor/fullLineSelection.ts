import { layer, RectangleMarker, type EditorView } from '@codemirror/view'

const CLS = 'cm-fullSel'

function markers(view: EditorView): RectangleMarker[] {
  const out: RectangleMarker[] = []
  const lh = view.defaultLineHeight
  for (const r of view.state.selection.ranges) {
    if (r.empty) continue
    const probe = view.coordsAtPos(r.from, 1) ?? view.coordsAtPos(r.from, -1)
    const glyph = probe ? probe.bottom - probe.top : lh
    const pad = Math.max(0, (lh - glyph) / 2)
    for (const m of RectangleMarker.forRange(view, CLS, r)) {
      const between = Math.abs(m.height - glyph) > 1
      const top = between ? m.top + pad : m.top - pad
      const height = between ? m.height - pad * 2 : m.height + pad * 2
      if (height <= 0.5) continue
      out.push(new RectangleMarker(CLS, m.left, top, m.width, height))
    }
  }
  return out
}

export const fullLineSelection = layer({
  above: false,
  class: 'cm-fullSelLayer',
  update: (u) => u.selectionSet || u.docChanged || u.viewportChanged || u.geometryChanged,
  markers
})