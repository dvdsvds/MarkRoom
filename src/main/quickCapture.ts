import { BrowserWindow, app, globalShortcut, ipcMain, screen } from 'electron'
import { appendFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { getRootDir } from './workspace/paths'

const SHORTCUT = 'CommandOrControl+Alt+N'
const INBOX_NAME = 'Inbox.md'

let quickWin: BrowserWindow | null = null

function createQuickWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 560,
    height: 112,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#18191c',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false
    }
  })

  win.on('blur', () => {
    if (!win.isDestroyed()) win.hide()
  })

  const devServerUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devServerUrl) {
    win.loadURL(`${devServerUrl}#quick`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'quick' })
  }
  return win
}

function showQuickWindow(): void {
  if (!quickWin || quickWin.isDestroyed()) quickWin = createQuickWindow()
  const win = quickWin
  const { x, y, width, height } = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).workArea
  const [w] = win.getSize()
  win.setPosition(Math.round(x + (width - w) / 2), Math.round(y + height * 0.25))
  win.show()
  win.focus()
  win.webContents.send('quick:shown')
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function appendToInbox(text: string): void {
  const now = new Date()
  const stamp = `${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const oneLine = text.replace(/\s*\r?\n\s*/g, ' ').trim()
  if (!oneLine) return
  const filePath = join(getRootDir(), INBOX_NAME)
  let prefix = ''
  if (existsSync(filePath)) {
    const current = readFileSync(filePath, 'utf-8')
    if (current.length > 0 && !current.endsWith('\n')) prefix = '\n'
  }
  appendFileSync(filePath, `${prefix}- ${stamp} ${oneLine}\n`, 'utf-8')
}

export function registerQuickCapture(): void {
  const ok = globalShortcut.register(SHORTCUT, showQuickWindow)
  if (!ok)
    console.warn(`퀵캡처 단축키(${SHORTCUT})를 등록하지 못했어요. 다른 앱이 쓰고 있을 수 있어요.`)

  quickWin = createQuickWindow()

  ipcMain.handle('quick:submit', (_event, text: string) => {
    appendToInbox(text)
    quickWin?.hide()
  })
  ipcMain.handle('quick:hide', () => {
    quickWin?.hide()
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
}

export function destroyQuickCapture(): void {
  if (quickWin && !quickWin.isDestroyed()) quickWin.destroy()
  quickWin = null
}
