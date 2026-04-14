import { useCallback, useEffect, useState } from 'react'
import type { CachedScriptMeta } from '../lib/catalogDb'
import { getScriptInstallState } from '../lib/scriptNeedsUpdate'

export type InstallButtonState = 'install' | 'update' | 'current' | 'unknown'

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
      const next = getScriptInstallState(script, m)
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
  }, [script])

  useEffect(() => {
    void reload()
  }, [reload])

  return { state, manifestLoading, reload }
}
