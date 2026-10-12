import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { dirname, join, resolve, sep } from 'path'
import { pathToFileURL } from 'url'
import { randomUUID } from 'crypto'

const MAX_BYTES = 20 * 1024 * 1024
const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src snote: data:; font-src data: file: http://localhost:*"

async function renderPdf(html: string, css: string, baseHref?: string): Promise<Buffer> {
  const base = baseHref ? `<base href="${baseHref}">` : ''
  const doc =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    `${base}<style>${css}</style></head><body>${html}</body></html>`

  const tmp = join(app.getPath('temp'), `snote-pdf-${randomUUID()}.html`)
  let win: BrowserWindow | null = null
  try {
    await fs.writeFile(tmp, doc, 'utf-8')
    win = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: false,
        devTools: false
      }
    })
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.webContents.on('will-navigate', (ev) => ev.preventDefault())
    await win.loadFile(tmp)
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    })
  } finally {
    if (win && !win.isDestroyed()) win.destroy()
    fs.unlink(tmp).catch(() => {})
  }
}

export function registerPdfExport(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    'export:pdf',
    async (_e, payload: { title: string; html: string; css: string }) => {
      const parent = getWindow()
      if (!payload || typeof payload.html !== 'string' || typeof payload.css !== 'string') {
        return { ok: false, error: '잘못된 요청이에요' }
      }
      if (payload.html.length + payload.css.length > MAX_BYTES) {
        return { ok: false, error: '문서가 너무 커요' }
      }

      const safeTitle = String(payload.title || '문서').replace(/[\\/:*?"<>|]/g, '_')
      const saveOpts = {
        defaultPath: `${safeTitle}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      }
      const save = parent
        ? await dialog.showSaveDialog(parent, saveOpts)
        : await dialog.showSaveDialog(saveOpts)
      if (save.canceled || !save.filePath) return { ok: false, canceled: true }

      try {
        const pdf = await renderPdf(payload.html, payload.css)
        await fs.writeFile(save.filePath, pdf)
        return { ok: true, path: save.filePath }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'export:pdfFile',
    async (_e, payload: { html: string; css: string; pdfDir: string; relPath: string }) => {
      if (
        !payload ||
        typeof payload.html !== 'string' ||
        typeof payload.css !== 'string' ||
        typeof payload.pdfDir !== 'string' ||
        typeof payload.relPath !== 'string'
      ) {
        return { ok: false, error: '잘못된 요청이에요' }
      }
      if (payload.html.length + payload.css.length > MAX_BYTES) {
        return { ok: false, error: '문서가 너무 커요' }
      }
      const root = resolve(payload.pdfDir)
      const destPath = resolve(root, payload.relPath)
      if (!destPath.startsWith(root + sep)) return { ok: false, error: '잘못된 경로예요' }

      try {
        await fs.mkdir(dirname(destPath), { recursive: true })
        let baseHref = pathToFileURL(dirname(destPath)).href
        if (!baseHref.endsWith('/')) baseHref += '/'
        const pdf = await renderPdf(payload.html, payload.css, baseHref)
        await fs.writeFile(destPath, pdf)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}
