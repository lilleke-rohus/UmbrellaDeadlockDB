import type { CachedScriptMeta } from './catalogDb'
import type { InstallManifest, ManifestEntry } from '../../../shared/ipc'

const VERSION_EPSILON = 0.000001

export type ScriptInstallState = 'not-installed' | 'current' | 'update-available'

export function getManifestEntry(
  manifest: InstallManifest,
  scriptId: string,
  filename?: string,
): ManifestEntry | undefined {
  const direct = manifest.entries[scriptId]
  if (direct) return direct
  const byScriptId = Object.values(manifest.entries).find((entry) => entry.scriptId === scriptId)
  if (byScriptId) return byScriptId
  if (filename) {
    const byFilenameKey = manifest.entries[filename]
    if (byFilenameKey) return byFilenameKey
    return Object.values(manifest.entries).find((entry) => entry.filename === filename)
  }
  return undefined
}

export function shouldUpdate(local: ManifestEntry, remote: Pick<CachedScriptMeta, 'content_version' | 'updated_at'>): boolean {
  const versionComparison = compareVersion(local.contentVersion, remote.content_version)
  if (versionComparison > 0) {
    return true
  }
  if (versionComparison < 0) return false

  return compareTimestamp(local.updatedAt, remote.updated_at) > 0
}

function compareVersion(localVersionValue: number, remoteVersionValue: number): number {
  const localVersion = Number(localVersionValue)
  const remoteVersion = Number(remoteVersionValue)
  if (Number.isFinite(localVersion) && Number.isFinite(remoteVersion)) {
    const delta = remoteVersion - localVersion
    if (Math.abs(delta) <= VERSION_EPSILON) return 0
    return delta > 0 ? 1 : -1
  }
  if (remoteVersionValue === localVersionValue) return 0
  return String(remoteVersionValue) > String(localVersionValue) ? 1 : -1
}

function compareTimestamp(localUpdatedAtValue: string, remoteUpdatedAtValue: string): number {
  const localUpdatedAt = Date.parse(localUpdatedAtValue)
  const remoteUpdatedAt = Date.parse(remoteUpdatedAtValue)
  if (Number.isFinite(localUpdatedAt) && Number.isFinite(remoteUpdatedAt)) {
    if (remoteUpdatedAt === localUpdatedAt) return 0
    return remoteUpdatedAt > localUpdatedAt ? 1 : -1
  }
  if (remoteUpdatedAtValue === localUpdatedAtValue) return 0
  return remoteUpdatedAtValue > localUpdatedAtValue ? 1 : -1
}

export function getScriptInstallState(
  script: Pick<CachedScriptMeta, 'id' | 'filename' | 'content_version' | 'updated_at'>,
  manifest: InstallManifest,
): ScriptInstallState {
  const entry = getManifestEntry(manifest, script.id, script.filename)
  if (!entry) return 'not-installed'
  return shouldUpdate(entry, script) ? 'update-available' : 'current'
}

/** True when the catalog row is newer than the installed manifest entry (same rules as the Install button). */
export function scriptNeedsUpdateFromManifest(
  script: Pick<CachedScriptMeta, 'id' | 'filename' | 'content_version' | 'updated_at'>,
  manifest: InstallManifest,
): boolean {
  return getScriptInstallState(script, manifest) === 'update-available'
}
