import { useCallback, useEffect, useState } from 'react'
import type { CachedScriptMeta } from '../lib/catalogDb'
import type { InstallManifest, ManifestEntry } from '../../../shared/ipc'

export type InstallButtonState = 'install' | 'update' | 'current' | 'unknown'

const VERSION_EPSILON = 0.000001

function getManifestEntry(manifest: InstallManifest, scriptId: string): ManifestEntry | undefined {
  return manifest.entries[scriptId] ?? Object.values(manifest.entries).find((entry) => entry.scriptId === scriptId)
}

function shouldUpdate(local: ManifestEntry, remote: CachedScriptMeta): boolean {
  const localVersion = Number(local.contentVersion)
  const remoteVersion = Number(remote.content_version)
  if (Number.isFinite(localVersion) && Number.isFinite(remoteVersion)) {
    if (remoteVersion - localVersion > VERSION_EPSILON) {
      return true
    }
  } else if (remote.content_version !== local.contentVersion) {
    return true
  }

  const localUpdatedAt = Date.parse(local.updatedAt)
  const remoteUpdatedAt = Date.parse(remote.updated_at)
  if (Number.isFinite(localUpdatedAt) && Number.isFinite(remoteUpdatedAt)) {
    return remoteUpdatedAt > localUpdatedAt
  }

  // Fallback for malformed timestamps; keeps previous behavior deterministic.
  return remote.updated_at > local.updatedAt
}

export function useInstallState(script: CachedScriptMeta | null): {
  state: InstallButtonState
  manifestLoading: boolean
  reload: () => Promise<void>
} {
  const [state, setState] = useState<InstallButtonState>('unknown')
  const [manifestLoading, setManifestLoading] = useState(true)

  const reload = useCallback(async (): Promise<void> => {
    if (!script) {
      setState('unknown')
      setManifestLoading(false)
      return
    }
    setManifestLoading(true)
    try {
      const m = await window.umbrella.getManifest()
      const entry = getManifestEntry(m, script.id)
      if (!entry) {
        const disk = await window.umbrella.readLocalScript(script.filename)
        if (disk.content) {
          setState('update')
        } else {
          setState('install')
        }
        return
      }
      if (shouldUpdate(entry, script)) {
        setState('update')
      } else {
        setState('current')
      }
    } finally {
      setManifestLoading(false)
    }
  }, [script])

  useEffect(() => {
    void reload()
  }, [reload])

  return { state, manifestLoading, reload }
}
