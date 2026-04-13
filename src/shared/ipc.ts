export type PickLuaScriptFileResult =
  | { filename: string; content: string }
  | { error: string }

export const IPC_CHANNELS = {
  getSettings: 'umbrella:get-settings',
  updateSettings: 'umbrella:update-settings',
  setScriptsRoot: 'umbrella:set-scripts-root',
  pickScriptsDirectory: 'umbrella:pick-scripts-directory',
  pickLuaScriptFile: 'umbrella:pick-lua-script-file',
  listLocalScripts: 'umbrella:list-local-scripts',
  readLocalScript: 'umbrella:read-local-script',
  writeScript: 'umbrella:write-script',
  deleteScript: 'umbrella:delete-script',
  getManifest: 'umbrella:get-manifest',
  setManifestEntry: 'umbrella:set-manifest-entry',
  revealInExplorer: 'umbrella:reveal-in-explorer',
  windowMinimize: 'umbrella:window-minimize',
  windowMaximize: 'umbrella:window-maximize',
  windowClose: 'umbrella:window-close',
  windowIsMaximized: 'umbrella:window-is-maximized',
  triggerAutoUpdate: 'umbrella:trigger-auto-update',
  // App self-update
  appCheckForUpdates: 'umbrella:app-check-for-updates',
  appInstallUpdate: 'umbrella:app-install-update',
  appUpdateAvailable: 'umbrella:app-update-available',
  appUpdateDownloadProgress: 'umbrella:app-update-download-progress',
  appUpdateDownloaded: 'umbrella:app-update-downloaded',
  appUpdateError: 'umbrella:app-update-error',
} as const

export type AppSettings = {
  scriptsRootPath: string | null
  autoUpdateScripts?: boolean
}

export type ManifestEntry = {
  scriptId: string
  filename: string
  contentVersion: number
  updatedAt: string
  installedAt: string
}

export type InstallManifest = {
  entries: Record<string, ManifestEntry>
}

export type AppUpdateInfo = {
  version: string
  releaseNotes?: string | null
}

export type AppUpdateProgress = {
  percent: number
  transferred: number
  total: number
}

export type IpcApi = {
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: Partial<AppSettings>) => Promise<{ ok: boolean; error?: string }>
  setScriptsRoot: (rootPath: string) => Promise<{ ok: boolean; error?: string }>
  pickScriptsDirectory: () => Promise<string | null>
  pickLuaScriptFile: () => Promise<PickLuaScriptFileResult | null>
  listLocalScripts: () => Promise<{ names: string[]; error?: string }>
  readLocalScript: (filename: string) => Promise<{ content: string | null; error?: string }>
  writeScript: (filename: string, contents: string) => Promise<{ ok: boolean; error?: string }>
  deleteScript: (filename: string) => Promise<{ ok: boolean; error?: string }>
  getManifest: () => Promise<InstallManifest>
  setManifestEntry: (key: string, entry: ManifestEntry | null) => Promise<{ ok: boolean; error?: string }>
  revealInExplorer: (filename?: string) => Promise<{ ok: boolean; error?: string }>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  windowIsMaximized: () => Promise<boolean>
  onTriggerAutoUpdate: (handler: () => void) => () => void
  // App self-update
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
  onAppUpdateAvailable: (handler: (info: AppUpdateInfo) => void) => () => void
  onAppUpdateDownloadProgress: (handler: (progress: AppUpdateProgress) => void) => () => void
  onAppUpdateDownloaded: (handler: (info: AppUpdateInfo) => void) => () => void
  onAppUpdateError: (handler: (message: string) => void) => () => void
}
