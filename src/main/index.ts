import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import electronUpdater from 'electron-updater'
import { APP_AUTH_PROTOCOL_SCHEME } from '../shared/authDeepLink'
import { IPC_CHANNELS, type PickLuaScriptFileResult } from '../shared/ipc'
import { resolveUnderRoot } from './paths'
import {
  readDota2Manifest,
  readManifest,
  readSettings,
  upsertDota2ManifestEntry,
  upsertManifestEntry,
  writeSettings,
} from './store'
import type { ManifestEntry } from '../shared/ipc'

const { autoUpdater } = electronUpdater

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

let mainWindowRef: BrowserWindow | null = null
let pendingAuthDeepLink: string | null = null

function findAuthDeepLinkInArgv(argv: readonly string[]): string | null {
  const scheme = `${APP_AUTH_PROTOCOL_SCHEME}://`
  for (const arg of argv) {
    if (typeof arg === 'string' && arg.startsWith(scheme)) {
      return arg.replace(/^"+|"+$/g, '')
    }
  }
  return null
}

function deliverAuthDeepLink(url: string): void {
  const trimmed = url.trim().replace(/^"+|"+$/g, '')
  if (!trimmed.startsWith(`${APP_AUTH_PROTOCOL_SCHEME}://`)) {
    return
  }
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(IPC_CHANNELS.authDeepLink, trimmed)
    return
  }
  pendingAuthDeepLink = trimmed
}

if (gotTheLock) {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(APP_AUTH_PROTOCOL_SCHEME, process.execPath, [path.resolve(process.argv[1])])
    }
  } else {
    app.setAsDefaultProtocolClient(APP_AUTH_PROTOCOL_SCHEME)
  }

  app.on('second-instance', (_event, commandLine) => {
    const scheme = `${APP_AUTH_PROTOCOL_SCHEME}://`
    const urlArg = commandLine.find((arg) => typeof arg === 'string' && arg.startsWith(scheme))
    if (urlArg) {
      deliverAuthDeepLink(urlArg)
    }
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      if (mainWindowRef.isMinimized()) {
        mainWindowRef.restore()
      }
      mainWindowRef.focus()
    }
  })

  if (process.platform === 'darwin') {
    app.on('open-url', (event, url) => {
      event.preventDefault()
      if (url.startsWith(`${APP_AUTH_PROTOCOL_SCHEME}://`)) {
        deliverAuthDeepLink(url)
      }
    })
  }
}

// Dev + `electron-vite preview`: isolated profile avoids Windows cache / quota DB errors.
// `ELECTRON_RENDERER_URL` is only set for `electron-vite dev`; preview still has `app.isPackaged === false`.
// Packaged installs keep the default Roaming profile.
if (process.env.ELECTRON_RENDERER_URL || !app.isPackaged) {
  const devUserData = path.join(app.getPath('appData'), 'umbrella-deadlock-db-dev')
  app.setPath('userData', devUserData)
  const diskCacheDir = path.join(devUserData, 'chromium-disk-cache')
  try {
    mkdirSync(diskCacheDir, { recursive: true })
    app.commandLine.appendSwitch('disk-cache-dir', diskCacheDir)
  } catch {
    // Still prefer isolated userData even if cache dir cannot be created.
  }
}

function setupAutoUpdater(win: BrowserWindow): void {
  // Lets `electron-vite dev` / `preview` hit GitHub releases using `dev-app-update.yml` next to package.json.
  // https://www.electron.build/auto-update.html#debugging
  autoUpdater.forceDevUpdateConfig = process.env.ELECTRON_FORCE_DEV_UPDATES === '1'

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    win.webContents.send(IPC_CHANNELS.appUpdateAvailable, {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    win.webContents.send(IPC_CHANNELS.appUpdateDownloadProgress, {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send(IPC_CHANNELS.appUpdateDownloaded, {
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
    })
  })

  autoUpdater.on('error', (err) => {
    win.webContents.send(IPC_CHANNELS.appUpdateError, err.message)
  })

  ipcMain.handle(IPC_CHANNELS.appCheckForUpdates, () => {
    void autoUpdater.checkForUpdates()
  })

  ipcMain.handle(IPC_CHANNELS.appDownloadUpdate, () => {
    void autoUpdater.downloadUpdate()
  })

  ipcMain.handle(IPC_CHANNELS.appInstallUpdate, () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

function createWindow(): BrowserWindow {
  Menu.setApplicationMenu(null)
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindowRef = win
  win.on('closed', () => {
    if (mainWindowRef === win) {
      mainWindowRef = null
    }
  })

  let didReveal = false
  const revealMainWindow = (): void => {
    if (didReveal || win.isDestroyed()) return
    didReveal = true
    win.show()
    const { autoUpdateScripts } = readSettings()
    if (autoUpdateScripts) {
      setTimeout(() => win.webContents.send(IPC_CHANNELS.triggerAutoUpdate), 2000)
    }
    if (!process.env.ELECTRON_RENDERER_URL) {
      setTimeout(() => void autoUpdater.checkForUpdates(), 3000)
    }
  }

  win.once('ready-to-show', revealMainWindow)
  // On some Windows setups `ready-to-show` never fires even though the page loads; still show UI.
  win.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!win.isDestroyed() && !win.isVisible()) {
        revealMainWindow()
      }
    }, 500)
  })
  win.webContents.once('did-fail-load', (_e, code, desc, url) => {
    console.error('[main] did-fail-load', { code, desc, url })
    revealMainWindow()
  })

  ipcMain.handle(IPC_CHANNELS.windowMinimize, () => { win.minimize() })
  ipcMain.handle(IPC_CHANNELS.windowMaximize, () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle(IPC_CHANNELS.windowClose, () => { win.close() })
  ipcMain.handle(IPC_CHANNELS.windowIsMaximized, () => win.isMaximized())
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
  return win
}

function ensureScriptsRoot(root: string): { ok: true } | { ok: false; error: string } {
  try {
    if (!existsSync(root)) {
      mkdirSync(root, { recursive: true })
    }
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

app.whenReady().then(() => {
  if (!gotTheLock) {
    return
  }

  ipcMain.handle(IPC_CHANNELS.getSettings, () => readSettings())

  ipcMain.handle(IPC_CHANNELS.updateSettings, (_e, patch: Partial<{ scriptsRootPath: string | null; autoUpdateScripts: boolean }>) => {
    try {
      const current = readSettings()
      writeSettings({ ...current, ...patch })
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.setScriptsRoot, (_e, rootPath: string) => {
    if (typeof rootPath !== 'string' || !rootPath.trim()) {
      return { ok: false, error: 'Invalid path' }
    }
    const ensured = ensureScriptsRoot(rootPath.trim())
    if (!ensured.ok) {
      return ensured
    }
    const current = readSettings()
    writeSettings({ ...current, scriptsRootPath: rootPath.trim() })
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.setDota2ScriptsRoot, (_e, rootPath: string) => {
    if (typeof rootPath !== 'string' || !rootPath.trim()) {
      return { ok: false, error: 'Invalid path' }
    }
    const ensured = ensureScriptsRoot(rootPath.trim())
    if (!ensured.ok) {
      return ensured
    }
    const current = readSettings()
    writeSettings({ ...current, dota2ScriptsRootPath: rootPath.trim() })
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.pickScriptsDirectory, async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) {
      return null
    }
    return res.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.pickLuaScriptFile, async (): Promise<PickLuaScriptFileResult | null> => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Lua', extensions: ['lua'] }]
    })
    if (res.canceled || !res.filePaths[0]) {
      return null
    }
    const fp = res.filePaths[0]
    const base = path.basename(fp)
    if (!base.toLowerCase().endsWith('.lua')) {
      return { error: 'Select a file whose name ends with .lua' }
    }
    try {
      const content = readFileSync(fp, 'utf-8')
      return { filename: base, content }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.listLocalScripts, (_e, game = 'deadlock') => {
    const settings = readSettings()
    const root = game === 'dota2' ? settings.dota2ScriptsRootPath : settings.scriptsRootPath
    if (!root) {
      return { names: [] as string[], error: 'Scripts folder not configured' }
    }
    try {
      const names = readdirSync(root).filter((n) => n.toLowerCase().endsWith('.lua'))
      return { names }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { names: [] as string[], error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.readLocalScript, (_e, filename: string, game = 'deadlock') => {
    const settings = readSettings()
    const root = game === 'dota2' ? settings.dota2ScriptsRootPath : settings.scriptsRootPath
    if (!root) {
      return { content: null, error: 'Scripts folder not configured' }
    }
    if (typeof filename !== 'string') {
      return { content: null, error: 'Invalid filename' }
    }
    const full = resolveUnderRoot(root, filename)
    if (!full) {
      return { content: null, error: 'Path not allowed' }
    }
    try {
      if (!existsSync(full)) {
        return { content: null }
      }
      const content = readFileSync(full, 'utf-8')
      return { content }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { content: null, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.writeScript, (_e, filename: string, contents: string, game = 'deadlock') => {
    const settings = readSettings()
    const root = game === 'dota2' ? settings.dota2ScriptsRootPath : settings.scriptsRootPath
    if (!root) {
      return { ok: false, error: 'Scripts folder not configured' }
    }
    if (typeof filename !== 'string' || typeof contents !== 'string') {
      return { ok: false, error: 'Invalid arguments' }
    }
    const base = path.basename(filename)
    if (base !== filename || !filename.toLowerCase().endsWith('.lua')) {
      return { ok: false, error: 'Filename must be a bare .lua name' }
    }
    const full = resolveUnderRoot(root, filename)
    if (!full) {
      return { ok: false, error: 'Path not allowed' }
    }
    const dir = path.dirname(full)
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
      writeFileSync(full, contents, 'utf-8')
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.deleteScript, (_e, filename: string, game = 'deadlock') => {
    const settings = readSettings()
    const root = game === 'dota2' ? settings.dota2ScriptsRootPath : settings.scriptsRootPath
    if (!root) {
      return { ok: false, error: 'Scripts folder not configured' }
    }
    if (typeof filename !== 'string') {
      return { ok: false, error: 'Invalid filename' }
    }
    const full = resolveUnderRoot(root, filename)
    if (!full) {
      return { ok: false, error: 'Path not allowed' }
    }
    try {
      if (existsSync(full)) {
        unlinkSync(full)
      }
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.getManifest, (_e, game = 'deadlock') =>
    game === 'dota2' ? readDota2Manifest() : readManifest()
  )

  ipcMain.handle(IPC_CHANNELS.setManifestEntry, (_e, key: string, entry: ManifestEntry | null, game = 'deadlock') => {
    if (typeof key !== 'string' || !key) {
      return { ok: false, error: 'Invalid key' }
    }
    try {
      if (game === 'dota2') {
        upsertDota2ManifestEntry(key, entry)
      } else {
        upsertManifestEntry(key, entry)
      }
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.revealInExplorer, (_e, filename?: string, game = 'deadlock') => {
    const settings = readSettings()
    const root = game === 'dota2' ? settings.dota2ScriptsRootPath : settings.scriptsRootPath
    if (!root) {
      return { ok: false, error: 'Scripts folder not configured' }
    }
    try {
      if (filename && typeof filename === 'string') {
        const full = resolveUnderRoot(root, filename)
        if (!full) {
          return { ok: false, error: 'Path not allowed' }
        }
        void shell.showItemInFolder(full)
      } else {
        void shell.openPath(root)
      }
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.getPendingAuthDeepLink, () => {
    const u = pendingAuthDeepLink
    pendingAuthDeepLink = null
    return u
  })

  const coldStartAuthUrl = findAuthDeepLinkInArgv(process.argv)
  if (coldStartAuthUrl) {
    pendingAuthDeepLink = coldStartAuthUrl
  }

  const win = createWindow()
  setupAutoUpdater(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
