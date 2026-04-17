import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type ActiveGame, type AppUpdateInfo, type AppUpdateProgress, type IpcApi, type ManifestEntry } from '../shared/ipc'

function makeListener<T>(channel: string, handler: (data: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, data: T): void => handler(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: IpcApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC_CHANNELS.updateSettings, patch),
  setScriptsRoot: (rootPath: string) => ipcRenderer.invoke(IPC_CHANNELS.setScriptsRoot, rootPath),
  setDota2ScriptsRoot: (rootPath: string) => ipcRenderer.invoke(IPC_CHANNELS.setDota2ScriptsRoot, rootPath),
  pickScriptsDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.pickScriptsDirectory),
  pickLuaScriptFile: () => ipcRenderer.invoke(IPC_CHANNELS.pickLuaScriptFile),
  listLocalScripts: (game?: ActiveGame) => ipcRenderer.invoke(IPC_CHANNELS.listLocalScripts, game),
  readLocalScript: (filename: string, game?: ActiveGame) => ipcRenderer.invoke(IPC_CHANNELS.readLocalScript, filename, game),
  writeScript: (filename: string, contents: string, game?: ActiveGame) =>
    ipcRenderer.invoke(IPC_CHANNELS.writeScript, filename, contents, game),
  deleteScript: (filename: string, game?: ActiveGame) => ipcRenderer.invoke(IPC_CHANNELS.deleteScript, filename, game),
  getManifest: (game?: ActiveGame) => ipcRenderer.invoke(IPC_CHANNELS.getManifest, game),
  setManifestEntry: (key: string, entry: ManifestEntry | null, game?: ActiveGame) =>
    ipcRenderer.invoke(IPC_CHANNELS.setManifestEntry, key, entry, game),
  revealInExplorer: (filename?: string, game?: ActiveGame) => ipcRenderer.invoke(IPC_CHANNELS.revealInExplorer, filename, game),
  windowMinimize: () => ipcRenderer.invoke(IPC_CHANNELS.windowMinimize),
  windowMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.windowMaximize),
  windowClose: () => ipcRenderer.invoke(IPC_CHANNELS.windowClose),
  windowIsMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.windowIsMaximized),
  onTriggerAutoUpdate: (handler: () => void) => {
    const listener = (): void => handler()
    ipcRenderer.on(IPC_CHANNELS.triggerAutoUpdate, listener)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.triggerAutoUpdate, listener)
  },
  // App self-update
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.appCheckForUpdates),
  downloadAppUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.appDownloadUpdate),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.appInstallUpdate),
  onAppUpdateAvailable: (handler) => makeListener<AppUpdateInfo>(IPC_CHANNELS.appUpdateAvailable, handler),
  onAppUpdateDownloadProgress: (handler) => makeListener<AppUpdateProgress>(IPC_CHANNELS.appUpdateDownloadProgress, handler),
  onAppUpdateDownloaded: (handler) => makeListener<AppUpdateInfo>(IPC_CHANNELS.appUpdateDownloaded, handler),
  onAppUpdateError: (handler) => makeListener<string>(IPC_CHANNELS.appUpdateError, handler),
  getPendingAuthDeepLink: () => ipcRenderer.invoke(IPC_CHANNELS.getPendingAuthDeepLink),
  onAuthDeepLink: (handler) => makeListener<string>(IPC_CHANNELS.authDeepLink, handler),
}

contextBridge.exposeInMainWorld('umbrella', api)
