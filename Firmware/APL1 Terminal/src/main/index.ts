import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join, basename } from 'path'
import { readFile } from 'fs/promises'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/types'
import type { ProgramEntry } from '../shared/types'
import { SerialService } from './serial'
import { SettingsService } from './settings'

let mainWindow: BrowserWindow | null = null
const serialService = new SerialService()
let settingsService: SettingsService | null = null // initialized after app is ready

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 1200,
    maxWidth: 1200,
    minHeight: 900,
    maxHeight: 900,
    fullscreenable: true,
    center: true,
    title: 'APL1 Terminal',
    backgroundColor: '#1a1a1a',
    show: false,
    ...(process.platform === 'linux' ? {} : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // Emit fullscreen state changes to renderer
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send(IPC.WINDOW_FULLSCREEN_CHANGED, true)
  })
  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send(IPC.WINDOW_FULLSCREEN_CHANGED, false)
  })

  // Block navigation to external URLs; open in system browser instead
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ---------------------------------------------------------------------------
// IPC handlers — serial and settings
// ---------------------------------------------------------------------------

ipcMain.handle(IPC.SERIAL_LIST_PORTS, () => serialService.listPorts())

ipcMain.handle(IPC.SERIAL_CONNECT, async (_event, path: string) => {
  if (!mainWindow) throw new Error('No main window')
  await serialService.connect(path, mainWindow)
})

ipcMain.handle(IPC.SERIAL_DISCONNECT, async () => {
  if (!mainWindow) return
  await serialService.disconnect(mainWindow)
})

ipcMain.handle(IPC.SERIAL_SEND, (_event, data: Uint8Array) => {
  serialService.send(data)
})

ipcMain.handle(IPC.SETTINGS_GET, () => settingsService?.get())

// ---------------------------------------------------------------------------
// IPC handlers — software / program loader
// ---------------------------------------------------------------------------

function getSoftwareDir(): string {
  return join(app.getAppPath(), 'software')
}

ipcMain.handle(IPC.SOFTWARE_GET_MANIFEST, async (): Promise<ProgramEntry[]> => {
  const manifestPath = join(getSoftwareDir(), 'manifest.json')
  const raw = await readFile(manifestPath, 'utf-8')
  const data = JSON.parse(raw) as { programs: ProgramEntry[] }
  return data.programs
})

ipcMain.handle(IPC.SOFTWARE_READ_FILE, async (_event, filename: string): Promise<string> => {
  // Reject any path traversal attempts
  const safe = basename(filename)
  if (!safe || safe !== filename || safe.includes('..')) {
    throw new Error('Invalid filename')
  }
  const filePath = join(getSoftwareDir(), safe)
  return readFile(filePath, 'utf-8')
})

ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Parameters<SettingsService['set']>[0]) => {
  settingsService?.set(partial)
})

ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())

ipcMain.handle(IPC.WINDOW_TOGGLE_FULLSCREEN, () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
  }
})

ipcMain.handle(IPC.WINDOW_IS_FULLSCREEN, () => mainWindow?.isFullScreen() ?? false)

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  settingsService = new SettingsService()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
