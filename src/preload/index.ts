import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppUpdateInfo, type AppUpdateProgress, type IpcApi, type ManifestEntry } from '../shared/ipc'

function makeListener<T>(channel: string, handler: (data: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, data: T): void => handler(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: IpcApi = {
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC_CHANNELS.updateSettings, patch),
  setScriptsRoot: (rootPath: string) => ipcRenderer.invoke(IPC_CHANNELS.setScriptsRoot, rootPath),
  pickScriptsDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.pickScriptsDirectory),
  pickLuaScriptFile: () => ipcRenderer.invoke(IPC_CHANNELS.pickLuaScriptFile),
  listLocalScripts: () => ipcRenderer.invoke(IPC_CHANNELS.listLocalScripts),
  readLocalScript: (filename: string) => ipcRenderer.invoke(IPC_CHANNELS.readLocalScript, filename),
  writeScript: (filename: string, contents: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.writeScript, filename, contents),
  deleteScript: (filename: string) => ipcRenderer.invoke(IPC_CHANNELS.deleteScript, filename),
  getManifest: () => ipcRenderer.invoke(IPC_CHANNELS.getManifest),
  setManifestEntry: (key: string, entry: ManifestEntry | null) =>
    ipcRenderer.invoke(IPC_CHANNELS.setManifestEntry, key, entry),
  revealInExplorer: (filename?: string) => ipcRenderer.invoke(IPC_CHANNELS.revealInExplorer, filename),
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
