import { supabase } from './supabase'
import type { InstallManifest } from '../../../shared/ipc'
import { getManifestEntry, shouldUpdate } from './scriptNeedsUpdate'

export type AutoUpdateResult = {
  updated: number
  skipped: number
  errors: string[]
}

/**
 * Compares every entry in the install manifest against the published store version.
 * Downloads and overwrites any script whose content_version or updated_at is newer.
 */
export async function runAutoUpdate(): Promise<AutoUpdateResult> {
  if (!supabase) {
    return { updated: 0, skipped: 0, errors: ['Supabase not configured'] }
  }

  const manifest = await window.umbrella.getManifest()
  const entries = Object.values(manifest.entries)

  if (entries.length === 0) {
    return { updated: 0, skipped: 0, errors: [] }
  }

  const ids = entries.map((e) => e.scriptId)

  const { data: scripts, error } = await supabase
    .from('scripts')
    .select('id, filename, content_version, content_hash, updated_at, lua_source')
    .in('id', ids)
    .eq('status', 'published')

  if (error) {
    return { updated: 0, skipped: 0, errors: [error.message] }
  }

  if (!scripts || scripts.length === 0) {
    return { updated: 0, skipped: entries.length, errors: [] }
  }

  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of scripts) {
    const entry = getManifestEntry(manifest, row.id, row.filename)
    if (!entry) continue

    const needsUpdate = shouldUpdate(entry, row)

    if (!needsUpdate) {
      skipped++
      continue
    }

    if (!row.lua_source) {
      skipped++
      continue
    }

    const writeRes = await window.umbrella.writeScript(row.filename, row.lua_source)
    if (!writeRes.ok) {
      errors.push(`${row.filename}: ${writeRes.error ?? 'write failed'}`)
      continue
    }

    await window.umbrella.setManifestEntry(row.id, {
      scriptId: row.id,
      filename: row.filename,
      contentVersion: row.content_version,
      contentHash: row.content_hash,
      updatedAt: row.updated_at,
      installedAt: entry.installedAt,
    })

    updated++
  }

  // Scripts in manifest that were not found in the published store are skipped silently
  const storeIds = new Set(scripts.map((s) => s.id))
  for (const e of entries) {
    if (!storeIds.has(e.scriptId)) skipped++
  }

  return { updated, skipped, errors }
}
