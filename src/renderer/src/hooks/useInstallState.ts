import { useCallback, useEffect, useState } from 'react'
import { useGame } from '../context/GameContext'
import type { CachedScriptMeta } from '../lib/catalogDb'
import { getScriptInstallState, shouldUpdate } from '../lib/scriptNeedsUpdate'
import { parseUmbrellaHeader } from '../lib/firstLine'
import { computeLuaContentHash } from '../lib/scriptHash'

export type InstallButtonState = 'install' | 'update' | 'current' | 'unknown'

export function useInstallState(script: CachedScriptMeta | null): {
  state: InstallButtonState
  manifestLoading: boolean
  reload: () => Promise<void>
} {
  const { activeGame } = useGame()
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
      const m = await window.umbrella.getManifest(activeGame)
      const local = await window.umbrella.readLocalScript(script.filename, activeGame)
      if (!local.content) {
        setState('install')
        return
      }
      const localHash = await computeLuaContentHash(local.content)
      if (script.content_hash) {
        setState(localHash === script.content_hash ? 'current' : 'update')
        return
      }
      let next = getScriptInstallState(script, m)
      if (next === 'not-installed') {
        const header = parseUmbrellaHeader(local.content)
        if (!header) {
          next = 'update-available'
        } else {
          const localManifestLike = {
            scriptId: script.id,
            filename: script.filename,
            contentVersion: header.version,
            updatedAt: header.iso,
            installedAt: header.iso,
          }
          next = shouldUpdate(localManifestLike, script) ? 'update-available' : 'current'
        }
      }
      switch (next) {
        case 'not-installed':
          setState('install')
          return
        case 'update-available':
          setState('update')
          return
        case 'current':
          setState('current')
          return
      }
    } catch {
      setState('unknown')
    } finally {
      setManifestLoading(false)
    }
  }, [script, activeGame])

  useEffect(() => {
    void reload()
  }, [reload])

  return { state, manifestLoading, reload }
}
