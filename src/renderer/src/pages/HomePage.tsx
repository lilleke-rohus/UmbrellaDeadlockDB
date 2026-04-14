import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useCatalog } from '../hooks/useCatalog'
import { useScriptUpdateHighlightSet } from '../hooks/useScriptUpdateHighlight'
import type { VaultOutletContext } from '../components/Layout'
import { IconRowScript, IconScriptTile } from '../components/NavIcons'

function SkeletonCard(): React.ReactElement {
  return (
    <div className="script-card" aria-hidden>
      <div className="card-header">
        <div className="sk" style={{ width: 34, height: 34, borderRadius: 8 }} />
        <div className="sk" style={{ width: 38, height: 18, borderRadius: 20 }} />
      </div>
      <div className="sk" style={{ height: 13, width: '65%', marginTop: 10, marginBottom: 6 }} />
      <div className="sk" style={{ height: 12, width: '40%', marginBottom: 10 }} />
      <div className="sk" style={{ height: 12, width: '100%', marginBottom: 4 }} />
      <div className="sk" style={{ height: 12, width: '75%', marginBottom: 10 }} />
      <div className="card-footer">
        <div className="sk" style={{ height: 11, width: '55%' }} />
      </div>
    </div>
  )
}

function SkeletonRow(): React.ReactElement {
  return (
    <div className="script-row" aria-hidden style={{ pointerEvents: 'none' }}>
      <div className="sk" style={{ width: 28, height: 28, borderRadius: 6 }} />
      <div className="row-info">
        <div className="sk" style={{ height: 13, width: '38%', marginBottom: 6 }} />
        <div className="sk" style={{ height: 12, width: '62%' }} />
      </div>
      <div className="row-right">
        <div className="sk" style={{ height: 11, width: 72 }} />
      </div>
    </div>
  )
}

function formatUpdated(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

export function HomePage(): React.ReactElement {
  const { storeSearch, storeView } = useOutletContext<VaultOutletContext>()
  const { items, loading, error, online, refresh } = useCatalog()
  const [cat, setCat] = useState<string | null>(null)
  const [sort, setSort] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest')

  const q = storeSearch

  const categories = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) {
      if (it.category) {
        s.add(it.category)
      }
    }
    return [...s].sort()
  }, [items])

  const filtered = useMemo(() => {
    let list = items
    if (cat) {
      list = list.filter((i) => i.category === cat)
    }
    if (q.trim()) {
      const n = q.toLowerCase()
      list = list.filter((i) => {
        const inTags = i.tags?.some((t) => t.toLowerCase().includes(n)) ?? false
        return (
          i.title.toLowerCase().includes(n) ||
          i.slug.toLowerCase().includes(n) ||
          (i.description?.toLowerCase().includes(n) ?? false) ||
          inTags
        )
      })
    }
    return list
  }, [items, q, cat])

  const sorted = useMemo(() => {
    const list = [...filtered]
    switch (sort) {
      case 'oldest': return list.sort((a, b) => a.updated_at.localeCompare(b.updated_at))
      case 'az':     return list.sort((a, b) => a.title.localeCompare(b.title))
      case 'za':     return list.sort((a, b) => b.title.localeCompare(a.title))
      default:       return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    }
  }, [filtered, sort])

  const catalogUpdateIds = useScriptUpdateHighlightSet(sorted)

  const hasFilters = Boolean(cat) || q.trim().length > 0
  const summary =
    items.length === 0
      ? 'No scripts in catalog yet.'
      : hasFilters
        ? `${filtered.length} of ${items.length} scripts`
        : `${items.length} script${items.length === 1 ? '' : 's'}`

  return (
    <div className="page home-page">
      <p className="store-lead muted">
        Browse scripts, install them to your scripts folder, and stay updated.
      </p>

      <div className="filter-bar" role="group" aria-label="Category">
        <button
          type="button"
          className={`filter-tag ${cat === null ? 'active' : ''}`}
          aria-pressed={cat === null}
          onClick={() => setCat(null)}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`filter-tag ${cat === c ? 'active' : ''}`}
            aria-pressed={cat === c}
            onClick={() => setCat(c)}
          >
            {c}
          </button>
        ))}
        <div className="filter-bar-end">
          <select
            className="admin-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort by"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="az">A–Z</option>
            <option value="za">Z–A</option>
          </select>
          {!online && (
            <span className="nav-badge" role="status" title="Offline — showing cached catalog">
              Cached
            </span>
          )}
          <button type="button" className="btn btn-compact" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh catalog'}
          </button>
        </div>
      </div>

      <div className="section-header">
        <span className="section-title">Script Store</span>
        <span className="section-count" aria-live="polite">
          {loading && !items.length ? 'Loading…' : summary}
        </span>
      </div>

      {error && !items.length && <p className="error">{error}</p>}

      {loading && !items.length ? (
        storeView === 'grid' ? (
          <div className="card-grid" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="row-list" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonRow key={i} />)}
          </div>
        )
      ) : storeView === 'grid' ? (
        <div className="card-grid fade-in" aria-label="Scripts">
          {sorted.map((s) => (
            <Link
              key={s.id}
              to={`/script/${s.slug}`}
              className={`script-card${catalogUpdateIds.has(s.id) ? ' script-card-has-update' : ''}`}
            >
              <div className="card-header">
                <div className="card-icon">
                  <IconScriptTile />
                </div>
                <span className="card-badge">v{s.content_version}</span>
              </div>
              <div className="card-name">{s.title}</div>
              <div className="card-author">by {s.author_display_name ?? 'Author'}</div>
              <div className="card-desc line-clamp">{s.description ?? 'No description.'}</div>
              {s.tags && s.tags.length > 0 && (
                <div className="card-tags">
                  {s.tags.slice(0, 5).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="card-footer">
                <div className="card-meta">
                  <span className="meta-item">Updated {formatUpdated(s.updated_at)}</span>
                  <span className="meta-item">{s.install_count ?? 0} installs</span>
                </div>
                <span className="install-btn">Open</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="row-list fade-in" aria-label="Scripts">
          {sorted.map((s) => (
            <Link
              key={s.id}
              to={`/script/${s.slug}`}
              className={`script-row${catalogUpdateIds.has(s.id) ? ' script-row-has-update' : ''}`}
            >
              <div className="row-icon">
                <IconRowScript />
              </div>
              <div className="row-info">
                <div className="row-name">{s.title}</div>
                <div className="row-desc line-clamp">
                  {s.description ?? 'No description.'} · by {s.author_display_name ?? 'Author'}
                </div>
              </div>
              <div className="row-right">
                {s.tags?.slice(0, 3).map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
                <span className="meta-item muted">v{s.content_version}</span>
                <span className="meta-item">{s.install_count ?? 0} installs</span>
                <span className="install-btn">Open</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !sorted.length && (
        <p className="muted empty-state">No scripts match your search or filter.</p>
      )}
    </div>
  )
}
