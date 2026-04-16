import { useEffect, useMemo, useRef, useState } from 'react'
import type { CachedScriptMeta } from '../lib/catalogDb'
import { getScriptInstallState } from '../lib/scriptNeedsUpdate'
import { supabase } from '../lib/supabase'
import type { InstallManifest } from '../../../shared/ipc'

export type ScriptUpdateRef = Pick<CachedScriptMeta, 'id' | 'filename' | 'content_version' | 'updated_at' | 'content_hash'>

async function mergeRemoteScriptMeta(scripts: ScriptUpdateRef[]): Promise<ScriptUpdateRef[]> {
  if (!supabase || scripts.length === 0) return scripts
  const ids = [...new Set(scripts.map((s) => s.id))]
  const { data, error } = await supabase
    .from('scripts')
    .select('id, content_version, content_hash, updated_at')
    .in('id', ids)
  if (error || !data?.length) return scripts
  const map = new Map(
    (data as { id: string; content_version: number; content_hash: string | null; updated_at: string }[]).map((r) => [r.id, r]),
  )
  return scripts.map((s) => {
    const r = map.get(s.id)
    return r ? { ...s, content_version: r.content_version, content_hash: r.content_hash, updated_at: r.updated_at } : s
  })
}

/** Same rules as the script detail Install/Update control (manifest-based install state). */
async function computeUpdateHighlightIds(scripts: ScriptUpdateRef[], manifest: InstallManifest): Promise<Set<string>> {
  const effective = await mergeRemoteScriptMeta(scripts)
  const next = new Set<string>()

  for (const s of effective) {
    if (getScriptInstallState(s, manifest) === 'update-available') {
      next.add(s.id)
    }
  }

  return next
}

/** Script ids where an install/update is available (aligned with `useInstallState` on the detail page). */
export function useScriptUpdateHighlightSet(scripts: ScriptUpdateRef[]): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set())
  const scriptsRef = useRef(scripts)
  scriptsRef.current = scripts

  const fingerprint = useMemo(
    () => scripts.map((s) => `${s.id}\0${s.content_version}\0${s.content_hash ?? ''}\0${s.updated_at}`).join('\n'),
    [scripts],
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = scriptsRef.current
      const manifest = await window.umbrella.getManifest()
      if (cancelled) return
      const next = await computeUpdateHighlightIds(list, manifest)
      if (!cancelled) setIds(next)
    })()
    return () => {
      cancelled = true
    }
  }, [fingerprint])

  return ids
}
