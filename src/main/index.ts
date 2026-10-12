import { app, shell, BrowserWindow, protocol, net, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerWorkspaceIpc } from './workspace/ipc'
import { stopWatcher } from './workspace/watcher'
import { assertInsideRoot, getLastSeenVersion, setLastSeenVersion } from './workspace/paths'
import { readChangelogFor } from './updateInfo'
import { registerQuickCapture, destroyQuickCapture } from './quickCapture'
import { registerCodeRunner } from './codeRunner'
import { registerPdfExport } from './pdfExport'
import { pathToFileURL } from 'url'

app.disableHardwareAcceleration()

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'snote',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  }
])

const devServerUrl = process.env['ELECTRON_RENDERER_URL']

let mainWindowRef: BrowserWindow | null = null

function isAllowedNavigationTarget(url: string): boolean {
  if (is.dev && devServerUrl && url.startsWith(devServerUrl)) return true
  return url.startsWith('file://')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1316,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    show: false,
    frame: false,
    roundedCorners: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  })

  mainWindowRef = mainWindow
  mainWindow.on('closed', () => {
    if (mainWindowRef === mainWindow) mainWindowRef = null
    destroyQuickCapture()
  })

  const sendMaximizedChanged = (): void => {
    mainWindow.webContents.send('window:maximized-changed', mainWindow.isMaximized())
  }
  mainWindow.on('maximize', sendMaximizedChanged)
  mainWindow.on('unmaximize', sendMaximizedChanged)

  mainWindow.on('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (!/^https?:\/\//.test(details.url)) return { action: 'deny' }
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigationTarget(url)) return
    event.preventDefault()
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
  })

  if (is.dev && devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.markroom.app')

  // app.on('browser-window-created', (_, window) => {
  //   optimizer.watchWindowShortcuts(window)
  // })

  registerWorkspaceIpc(() => mainWindowRef)
  registerQuickCapture()
  registerCodeRunner()
  registerPdfExport(() => mainWindowRef)

  ipcMain.handle('window:minimize', () => mainWindowRef?.minimize())
  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindowRef) return
    if (mainWindowRef.isMaximized()) mainWindowRef.unmaximize()
    else mainWindowRef.maximize()
  })
  ipcMain.handle('window:close', () => mainWindowRef?.close())
  ipcMain.handle('window:isMaximized', () => mainWindowRef?.isMaximized() ?? false)
  ipcMain.handle('window:platform', () => process.platform)

  const currentVersion = app.getVersion()
  const lastSeenVersion = getLastSeenVersion()
  const changelogToShow =
    lastSeenVersion && lastSeenVersion !== currentVersion ? readChangelogFor(currentVersion) : null
  setLastSeenVersion(currentVersion)
  ipcMain.handle('app:getChangelog', () => changelogToShow)

  if (!is.dev) {
    autoUpdater.autoDownload = true
    autoUpdater.on('error', (err) => {
      console.error('자동 업데이트 확인에 실패했어요:', err)
    })
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }

  protocol.handle('snote', async (request) => {
    try {
      let p = decodeURIComponent(new URL(request.url).pathname)
      if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1)
      const safePath = assertInsideRoot(p)
      const res = await net.fetch(pathToFileURL(safePath).href)
      const headers = new Headers(res.headers)
      headers.set('Access-Control-Allow-Origin', '*')
      return new Response(res.body, { status: res.status, headers })
    } catch {
      return new Response(null, { status: 404 })
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopWatcher()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
