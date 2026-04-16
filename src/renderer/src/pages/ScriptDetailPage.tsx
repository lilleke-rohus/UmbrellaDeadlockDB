import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { ScriptRow } from '../../../shared/supabase.types'
import { useInstallState } from '../hooks/useInstallState'
import type { CachedScriptMeta } from '../lib/catalogDb'
import { useToast } from '../context/ToastContext'
import { userFacingMessage } from '../lib/userFacingError'
import { IconScriptTile } from '../components/NavIcons'

type ChangelogEntry = { id: string; version: number; body: string; created_at: string }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function SkeletonDetail(): React.ReactElement {
  return (
    <div className="page detail-page" aria-hidden>
      <div className="sk" style={{ height: 13, width: 56, marginBottom: 16 }} />

      <div className="detail-hero">
        <div className="sk" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} />
        <div className="detail-hero-body">
          <div className="detail-hero-top" style={{ marginBottom: 10 }}>
            <div className="sk" style={{ height: 18, width: 220 }} />
            <div className="sk" style={{ height: 20, width: 52, borderRadius: 20 }} />
          </div>
          <div className="sk" style={{ height: 12, width: 200 }} />
        </div>
      </div>

      <div className="detail-action-bar">
        <div className="detail-action-primary">
          <div className="sk" style={{ height: 30, width: 88, borderRadius: 8 }} />
          <div className="sk" style={{ height: 30, width: 120, borderRadius: 8 }} />
          <div className="sk" style={{ height: 30, width: 96, borderRadius: 8 }} />
        </div>
      </div>

      <div className="detail-desc-section">
        <div className="sk" style={{ height: 11, width: 80, marginBottom: 10 }} />
        <div className="sk" style={{ height: 13, width: '100%', marginBottom: 5 }} />
        <div className="sk" style={{ height: 13, width: '100%', marginBottom: 5 }} />
        <div className="sk" style={{ height: 13, width: '60%' }} />
      </div>
    </div>
  )
}

export function ScriptDetailPage(): React.ReactElement {
  const { slug } = useParams()
  const { user } = useAuth()
  const { addToast } = useToast()
  const [row, setRow] = useState<ScriptRow | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [luaSource, setLuaSource] = useState<string | null>(null)
  const [showSource, setShowSource] = useState(false)
  const [changelogHistory, setChangelogHistory] = useState<ChangelogEntry[]>([])

  const meta: CachedScriptMeta | null = useMemo(
    () =>
      row
        ? {
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            category: row.category,
            tags: row.tags,
            filename: row.filename,
            status: row.status,
            content_version: row.content_version,
            content_hash: row.content_hash,
            updated_at: row.updated_at,
            published_at: row.published_at,
            author_id: row.author_id,
            author_display_name: null,
            install_count: (row as unknown as { install_count?: number }).install_count ?? 0,
          }
        : null,
    [row]
  )

  const { state: installState, manifestLoading, reload } = useInstallState(meta)

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      return
    }
    if (!supabase) {
      setErr('Supabase is not configured')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLuaSource(null)
    setShowSource(false)
    setChangelogHistory([])
    void (async () => {
      const { data, error } = await supabase
        .from('scripts')
        .select(
          'id, slug, title, description, category, tags, filename, status, content_version, content_hash, updated_at, published_at, author_id, changelog, install_count'
        )
        .eq('slug', slug)
        .maybeSingle()
      if (cancelled) return
      if (error) {
        setErr(userFacingMessage(error))
        setRow(null)
        setLoading(false)
        return
      }
      setRow((data as ScriptRow) ?? null)
      setLoading(false)
      if (supabase && data) {
        void supabase
          .from('script_changelog')
          .select('id, version, body, created_at')
          .eq('script_id', (data as { id: string }).id)
          .order('version', { ascending: false })
          .then(({ data: log }) => {
            if (!cancelled) setChangelogHistory((log as ChangelogEntry[]) ?? [])
          })
      }
    })()
    return () => { cancelled = true }
  }, [slug])

  async function toggleSource(): Promise<void> {
    if (showSource) { setShowSource(false); return }
    if (!luaSource && supabase && row) {
      const { data } = await supabase.from('scripts').select('lua_source').eq('id', row.id).single()
      setLuaSource((data as { lua_source: string | null } | null)?.lua_source ?? null)
    }
    setShowSource(true)
  }

  async function installOrUpdate(): Promise<void> {
    if (!row) return
    setBusy(true)
    try {
      const settings = await window.umbrella.getSettings()
      if (!settings.scriptsRootPath) {
        addToast('Choose a scripts folder in Settings first.', 'error')
        return
      }
      let source = luaSource
      if (!source) {
        if (!supabase) {
          addToast('Could not fetch script source.', 'error')
          return
        }
        const { data: src } = await supabase.from('scripts').select('lua_source').eq('id', row.id).single()
        if (!src || !(src as { lua_source: string | null }).lua_source) {
          addToast('Could not fetch script source.', 'error')
          return
        }
        source = (src as { lua_source: string }).lua_source
        setLuaSource(source)
      }
      const w = await window.umbrella.writeScript(row.filename, source)
      if (!w.ok) {
        addToast(w.error ?? 'Write failed', 'error')
        return
      }
      const inst = await window.umbrella.setManifestEntry(row.id, {
        scriptId: row.id,
        filename: row.filename,
        contentVersion: row.content_version,
        contentHash: row.content_hash,
        updatedAt: row.updated_at,
        installedAt: new Date().toISOString()
      })
      if (!inst.ok) {
        addToast(inst.error ?? 'Manifest update failed', 'error')
        return
      }
      if (installState === 'install' && supabase && user) {
        await supabase.rpc('increment_install_count', { p_script_id: row.id })
      }
      addToast('Saved to your scripts folder.', 'success')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  async function uninstall(): Promise<void> {
    if (!row) return
    setBusy(true)
    try {
      await window.umbrella.deleteScript(row.filename)
      await window.umbrella.setManifestEntry(row.id, null)
      addToast('Script uninstalled.', 'info')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  if (!slug) return <p className="error">Missing slug</p>
  if (err) return <p className="error">{err}</p>
  if (loading) return <SkeletonDetail />
  if (!row) {
    return (
      <div className="page">
        <p className="muted">Script not found.</p>
        <Link to="/">Store</Link>
      </div>
    )
  }

  const installCount = (row as unknown as { install_count?: number }).install_count ?? 0
  const actionLabel = installState === 'update' ? 'Update' : installState === 'current' ? 'Reinstall' : 'Install'
  const isInstalled = installState === 'current' || installState === 'update'

  return (
    <div className="page detail-page fade-in">
      <Link to="/" className="detail-back">← Store</Link>

      {/* Hero header — mirrors card layout */}
      <div className="detail-hero">
        <div className="detail-hero-icon">
          <IconScriptTile />
        </div>
        <div className="detail-hero-body">
          <div className="detail-hero-top">
            <h1 className="detail-title">{row.title}</h1>
            <div className="detail-hero-badges">
              <span className="card-badge">v{row.content_version}</span>
              {installState === 'current' && <span className="badge-ok">Up to date</span>}
              {installState === 'update' && <span className="badge-update">Update available</span>}
            </div>
          </div>
          <div className="detail-meta-row">
            <span className="meta-item">{row.filename}</span>
            <span className="detail-meta-sep">·</span>
            <span className="meta-item">{installCount} installs</span>
            <span className="detail-meta-sep">·</span>
            <span className="meta-item">Updated {formatDate(row.updated_at)}</span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="detail-action-bar" aria-label="Install actions">
        <div className="detail-action-primary">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || manifestLoading || installState === 'unknown'}
            onClick={() => void installOrUpdate()}
            aria-busy={busy}
          >
            {busy ? 'Working…' : actionLabel}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={installState === 'install'}
            onClick={() => void window.umbrella.revealInExplorer(row.filename)}
          >
            Show in Explorer
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void toggleSource()}
          >
            {showSource ? 'Hide source' : 'View source'}
          </button>
        </div>
        {isInstalled && (
          <button
            type="button"
            className="btn danger"
            disabled={busy || manifestLoading}
            onClick={() => void uninstall()}
          >
            Uninstall
          </button>
        )}
      </div>

      {/* Description */}
      <section className="detail-desc-section" aria-labelledby="description-heading">
        <h2 className="detail-section-label" id="description-heading">
          Description
        </h2>
        <p className="detail-desc">{row.description?.trim() || 'No description.'}</p>
      </section>

      {/* Tags */}
      {row.tags && row.tags.length > 0 && (
        <div className="detail-tags">
          {row.tags.map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}

      {/* Changelog */}
      {changelogHistory.length > 0 ? (
        <section className="settings-section" aria-labelledby="changelog-heading">
          <div className="settings-section-title" id="changelog-heading">Changelog</div>
          <div className="changelog-box">
            {changelogHistory.map((entry) => (
              <div key={entry.id} style={{ marginBottom: '1rem' }}>
                <div className="muted small" style={{ marginBottom: '0.25rem' }}>
                  v{entry.version} · {new Date(entry.created_at).toLocaleDateString()}
                </div>
                <pre className="changelog">{entry.body}</pre>
              </div>
            ))}
          </div>
        </section>
      ) : row.changelog ? (
        <section className="settings-section" aria-labelledby="changelog-heading">
          <div className="settings-section-title" id="changelog-heading">Changelog</div>
          <div className="changelog-box">
            <pre className="changelog">{row.changelog}</pre>
          </div>
        </section>
      ) : null}

      {/* Source */}
      {showSource && luaSource && (
        <section className="settings-section">
          <div className="settings-section-title">Source</div>
          <div className="changelog-box" style={{ maxHeight: 400, overflow: 'auto' }}>
            <pre className="changelog">{luaSource}</pre>
          </div>
        </section>
      )}
    </div>
  )
}
