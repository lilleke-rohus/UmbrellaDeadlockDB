import { useCallback, useEffect, useState } from 'react'
import type { ActiveGame } from '../../../shared/ipc'
import type { CachedScriptMeta } from '../lib/catalogDb'
import { loadCachedCatalog, mergeCatalogFromRemote } from '../lib/catalogDb'
import { supabase } from '../lib/supabase'

const SCRIPT_TABLE: Record<ActiveGame, string> = {
  deadlock: 'scripts',
  dota2: 'dota2_scripts',
}

export function useCatalog(game: ActiveGame = 'deadlock'): {
  items: CachedScriptMeta[]
  loading: boolean
  error: string | null
  online: boolean
  refresh: () => Promise<void>
} {
  const [items, setItems] = useState<CachedScriptMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  const refresh = useCallback(async () => {
    if (!supabase) {
      setItems(await loadCachedCatalog(game))
      setLoading(false)
      setError('Supabase is not configured')
      return
    }
    setError(null)
    const cached = await loadCachedCatalog(game)
    if (cached.length) {
      setItems(cached)
    }
    setLoading(true)
    try {
      const table = SCRIPT_TABLE[game]
      const { data, error: qErr } = await supabase
        .from(table)
        .select(
          'id, slug, title, description, category, tags, filename, status, content_version, content_hash, updated_at, published_at, author_id, install_count, author_display_name_override, author:profiles!author_id(display_name)'
        )
        .eq('status', 'published')
        .order('updated_at', { ascending: false })

      if (qErr) {
        throw qErr
      }
      const rows = (data ?? []) as unknown[]
      const mapped: CachedScriptMeta[] = rows.map((r) => {
        const row = r as Record<string, unknown>
        const authorJoin = (row.author as { display_name: string | null } | null)
        return {
          id: row.id as string,
          slug: row.slug as string,
          title: row.title as string,
          description: (row.description as string | null) ?? null,
          category: (row.category as string | null) ?? null,
          tags: (row.tags as string[] | null) ?? null,
          filename: row.filename as string,
          status: row.status as string,
          content_version: row.content_version as number,
          content_hash: (row.content_hash as string | null) ?? null,
          updated_at: row.updated_at as string,
          published_at: (row.published_at as string | null) ?? null,
          author_id: row.author_id as string,
          author_display_name: (row.author_display_name_override as string | null) ?? authorJoin?.display_name ?? null,
          install_count: (row.install_count as number) ?? 0,
          author_display_name_override: (row.author_display_name_override as string | null) ?? null,
        }
      })
      await mergeCatalogFromRemote(mapped, game)
      setItems(mapped)
      setOnline(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      setOnline(false)
      const fallback = await loadCachedCatalog(game)
      if (fallback.length) {
        setItems(fallback)
      }
    } finally {
      setLoading(false)
    }
  }, [game])

  useEffect(() => {
    setItems([])
    setLoading(true)
    void refresh()
  }, [game, refresh])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return { items, loading, error, online, refresh }
}
