import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { AppSettings, InstallManifest, ManifestEntry } from '../shared/ipc'

const SETTINGS_FILE = 'settings.json'
const MANIFEST_FILE = 'install-manifest.json'
const MANIFEST_DOTA2_FILE = 'install-manifest-dota2.json'

function createEmptyManifest(): InstallManifest {
  return { entries: {} }
}

function dataDir(): string {
  const dir = app.getPath('userData')
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

function dota2ManifestPath(): string {
  return path.join(dataDir(), MANIFEST_DOTA2_FILE)
}

const DEFAULT_WINDOWS_UMBRELLA_ROOT = 'C:\\Umbrella'

function isWindows(): boolean {
  return process.platform === 'win32'
}

function defaultSettings(): AppSettings {
  return {
    umbrellaRootPath: isWindows() ? DEFAULT_WINDOWS_UMBRELLA_ROOT : null,
  }
}

function normalizeSettings(parsed: AppSettings): AppSettings {
  const legacyUmbrellaRoot =
    typeof (parsed as AppSettings & { scriptsRootPath?: unknown }).scriptsRootPath === 'string'
      ? (parsed as AppSettings & { scriptsRootPath: string }).scriptsRootPath
      : null

  return {
    umbrellaRootPath:
      typeof parsed.umbrellaRootPath === 'string'
        ? parsed.umbrellaRootPath
        : legacyUmbrellaRoot ?? (isWindows() ? DEFAULT_WINDOWS_UMBRELLA_ROOT : null),
    autoUpdateScripts: parsed.autoUpdateScripts === true,
  }
}

export function readSettings(): AppSettings {
  const p = settingsPath()
  if (!existsSync(p)) {
    return defaultSettings()
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as AppSettings
    return normalizeSettings(parsed)
  } catch {
    return defaultSettings()
  }
}

export function writeSettings(settings: AppSettings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
}

function readManifestFile(p: string): InstallManifest {
  if (!existsSync(p)) {
    return createEmptyManifest()
  }
  try {
    const raw = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as InstallManifest
    if (!parsed.entries || typeof parsed.entries !== 'object') {
      return createEmptyManifest()
    }
    return { entries: parsed.entries }
  } catch {
    return createEmptyManifest()
  }
}

function writeManifestFile(p: string, manifest: InstallManifest): void {
  writeFileSync(p, JSON.stringify(manifest, null, 2), 'utf-8')
}

function upsertManifestEntryInFile(p: string, key: string, entry: ManifestEntry | null): void {
  const manifest = readManifestFile(p)
  if (entry === null) {
    delete manifest.entries[key]
  } else {
    manifest.entries[key] = entry
  }
  writeManifestFile(p, manifest)
}

export function readManifest(): InstallManifest {
  return readManifestFile(manifestPath())
}

export function writeManifest(manifest: InstallManifest): void {
  writeManifestFile(manifestPath(), manifest)
}

export function upsertManifestEntry(key: string, entry: ManifestEntry | null): void {
  upsertManifestEntryInFile(manifestPath(), key, entry)
}

export function readDota2Manifest(): InstallManifest {
  return readManifestFile(dota2ManifestPath())
}

export function writeDota2Manifest(manifest: InstallManifest): void {
  writeManifestFile(dota2ManifestPath(), manifest)
}

export function upsertDota2ManifestEntry(key: string, entry: ManifestEntry | null): void {
  upsertManifestEntryInFile(dota2ManifestPath(), key, entry)
}
