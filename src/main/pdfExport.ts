import { BrowserWindow, app, dialog, ipcMain } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const MAX_BYTES = 20 * 1024 * 1024

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

      const csp =
        "default-src 'none'; style-src 'unsafe-inline'; img-src snote: data:; font-src data: file: http://localhost:*"
      const doc =
        `<!doctype html><html><head><meta charset="utf-8">` +
        `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
        `<style>${payload.css}</style></head><body>${payload.html}</body></html>`

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
            javascript: false
          }
        })
        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
        win.webContents.on('will-navigate', (ev) => ev.preventDefault())

        await win.loadFile(tmp)
        const pdf = await win.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          preferCSSPageSize: true
        })
        await fs.writeFile(save.filePath, pdf)
        return { ok: true, path: save.filePath }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      } finally {
        if (win && !win.isDestroyed()) win.destroy()
        fs.unlink(tmp).catch(() => {})
      }
    }
  )
}