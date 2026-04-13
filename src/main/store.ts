import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { AppSettings, InstallManifest, ManifestEntry } from '../shared/ipc'

const SETTINGS_FILE = 'settings.json'
const MANIFEST_FILE = 'install-manifest.json'

function dataDir(): string {
  const dir = path.join(app.getPath('userData'))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

function settingsPath(): string {
  return path.join(dataDir(), SETTINGS_FILE)
}

function manifestPath(): string {
  return path.join(dataDir(), MANIFEST_FILE)
}

const DEFAULT_WINDOWS_ROOT = 'C:\\Umbrella\\deadlock_scripts'

export function readSettings(): AppSettings {
  const p = settingsPath()
  if (!existsSync(p)) {
    return { scriptsRootPath: process.platform === 'win32' ? DEFAULT_WINDOWS_ROOT : null }
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as AppSettings
    return {
      scriptsRootPath:
        typeof parsed.scriptsRootPath === 'string' ? parsed.scriptsRootPath : null,
      autoUpdateScripts: parsed.autoUpdateScripts === true,
    }
  } catch {
    return { scriptsRootPath: process.platform === 'win32' ? DEFAULT_WINDOWS_ROOT : null }
  }
}

export function writeSettings(settings: AppSettings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

export function readManifest(): InstallManifest {
  const p = manifestPath()
  if (!existsSync(p)) {
    return { entries: {} }
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as InstallManifest
    if (!parsed.entries || typeof parsed.entries !== 'object') {
      return { entries: {} }
    }
    return { entries: parsed.entries }
  } catch {
    return { entries: {} }
  }
}

export function writeManifest(manifest: InstallManifest): void {
  writeFileSync(manifestPath(), JSON.stringify(manifest, null, 2), 'utf-8')
}

export function upsertManifestEntry(key: string, entry: ManifestEntry | null): void {
  const m = readManifest()
  if (entry === null) {
    delete m.entries[key]
  } else {
    m.entries[key] = entry
  }
  writeManifest(m)
}
