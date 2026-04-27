import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type ActiveGame, type AppUpdateInfo, type AppUpdateProgress, type IpcApi, type ManifestEntry } from '../shared/ipc'

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>
}

function subscribe<T>(channel: string, handler: (data: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T): void => handler(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

function subscribeWithoutPayload(channel: string, handler: () => void): () => void {
  const listener = (): void => handler()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: IpcApi = {
  getSettings: () => invoke(IPC_CHANNELS.getSettings),
  updateSettings: (patch) => invoke(IPC_CHANNELS.updateSettings, patch),
  setUmbrellaRoot: (rootPath: string) => invoke(IPC_CHANNELS.setUmbrellaRoot, rootPath),
  pickScriptsDirectory: () => invoke(IPC_CHANNELS.pickScriptsDirectory),
  pickLuaScriptFile: () => invoke(IPC_CHANNELS.pickLuaScriptFile),
  listLocalScripts: (game?: ActiveGame) => invoke(IPC_CHANNELS.listLocalScripts, game),
  readLocalScript: (filename: string, game?: ActiveGame) => invoke(IPC_CHANNELS.readLocalScript, filename, game),
  writeScript: (filename: string, contents: string, game?: ActiveGame) => invoke(IPC_CHANNELS.writeScript, filename, contents, game),
  deleteScript: (filename: string, game?: ActiveGame) => invoke(IPC_CHANNELS.deleteScript, filename, game),
  getManifest: (game?: ActiveGame) => invoke(IPC_CHANNELS.getManifest, game),
  setManifestEntry: (key: string, entry: ManifestEntry | null, game?: ActiveGame) => invoke(IPC_CHANNELS.setManifestEntry, key, entry, game),
  revealInExplorer: (filename?: string, game?: ActiveGame) => invoke(IPC_CHANNELS.revealInExplorer, filename, game),
  windowMinimize: () => invoke(IPC_CHANNELS.windowMinimize),
  windowMaximize: () => invoke(IPC_CHANNELS.windowMaximize),
  windowClose: () => invoke(IPC_CHANNELS.windowClose),
  windowIsMaximized: () => invoke(IPC_CHANNELS.windowIsMaximized),
  onTriggerAutoUpdate: (handler: () => void) => subscribeWithoutPayload(IPC_CHANNELS.triggerAutoUpdate, handler),
  checkForUpdates: () => invoke(IPC_CHANNELS.appCheckForUpdates),
  downloadAppUpdate: () => invoke(IPC_CHANNELS.appDownloadUpdate),
  installUpdate: () => invoke(IPC_CHANNELS.appInstallUpdate),
  onAppUpdateAvailable: (handler) => subscribe<AppUpdateInfo>(IPC_CHANNELS.appUpdateAvailable, handler),
  onAppUpdateDownloadProgress: (handler) => subscribe<AppUpdateProgress>(IPC_CHANNELS.appUpdateDownloadProgress, handler),
  onAppUpdateDownloaded: (handler) => subscribe<AppUpdateInfo>(IPC_CHANNELS.appUpdateDownloaded, handler),
  onAppUpdateError: (handler) => subscribe<string>(IPC_CHANNELS.appUpdateError, handler),
  getPendingAuthDeepLink: () => invoke(IPC_CHANNELS.getPendingAuthDeepLink),
  onAuthDeepLink: (handler) => subscribe<string>(IPC_CHANNELS.authDeepLink, handler),
  launchLoader: () => invoke(IPC_CHANNELS.launchLoader),
  openExternalUrl: (url: string) => invoke(IPC_CHANNELS.openExternalUrl, url),
  toggleScriptEnabled: (filename: string, enable: boolean, game?: ActiveGame) => invoke(IPC_CHANNELS.toggleScriptEnabled, filename, enable, game),
}

contextBridge.exposeInMainWorld('umbrella', api)
