import { useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { useCatalog } from '../hooks/useCatalog'
import { useScriptUpdateHighlightSet } from '../hooks/useScriptUpdateHighlight'
import type { VaultOutletContext } from '../components/Layout'
import { IconRowScript, IconScriptTile } from '../components/NavIcons'
import { useGame } from '../context/GameContext'
import { stripMarkdown } from '../lib/stripMarkdown'

type CatalogItem = ReturnType<typeof useCatalog>['items'][number]

function collectCategories(items: CatalogItem[]): string[] {
  const categories = new Set<string>()
  for (const item of items) {
    if (item.category) {
      categories.add(item.category)
    }
  }
  return [...categories].sort()
}

function matchesSearchQuery(item: CatalogItem, query: string): boolean {
  const normalizedQuery = query.toLowerCase()
  const matchesTag = item.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ?? false
  return (
    item.title.toLowerCase().includes(normalizedQuery) ||
    item.slug.toLowerCase().includes(normalizedQuery) ||
    (item.description?.toLowerCase().includes(normalizedQuery) ?? false) ||
    matchesTag
  )
}

function filterCatalog(items: CatalogItem[], category: string | null, query: string): CatalogItem[] {
  return items.filter((item) => {
    if (category && item.category !== category) {
      return false
    }
    if (!query.trim()) {
      return true
    }
    return matchesSearchQuery(item, query)
  })
}

function buildSummary(total: number, visible: number, hasFilters: boolean): string {
  if (total === 0) {
    return 'No scripts in catalog yet.'
  }
  if (hasFilters) {
    return `${visible} of ${total} scripts`
  }
  return `${total} script${total === 1 ? '' : 's'}`
}

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
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}


const SKELETON_KEYS = [1, 2, 3, 4, 5, 6] as const

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function isNewScript(publishedAt: string | null): boolean {
  if (!publishedAt) return false
  return Date.now() - new Date(publishedAt).getTime() < SEVEN_DAYS_MS
}

function buildTrendingSet(items: CatalogItem[], topN = 3): Set<string> {
  const sorted = [...items].sort((a, b) => (b.install_count ?? 0) - (a.install_count ?? 0))
  return new Set(sorted.slice(0, topN).map((s) => s.id))
}

function buildFeaturedList(items: CatalogItem[]): CatalogItem[] {
  return items.filter((s) => s.featured)
}

function IcoTrendArrow(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 7.5l2.5-2.5 2 2L9 3"/>
      <path d="M7 3h2v2"/>
    </svg>
  )
}

function IcoStar(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
      <path d="M5 1l1.1 2.5H9L6.9 5.2l.8 2.6L5 6.3l-2.7 1.5.8-2.6L1 3.5h2.9L5 1Z"/>
    </svg>
  )
}

function FeaturedCard({ script }: { script: CatalogItem }): React.ReactElement {
  const navigate = useNavigate()
  return (
    <div
      className="featured-card fadeup"
      onClick={() => void navigate(`/script/${script.slug}`)}
    >
      <div className="featured-card-accent">
        <div className="featured-card-accent-inner" />
      </div>

      <div className="featured-card-header">
        <div className="featured-card-title-block">
          <div className="card-icon"><IconScriptTile /></div>
          <div>
            <div className="featured-card-title">{script.title}</div>
            <div className="featured-card-author">by {script.author_display_name ?? 'Author'}</div>
          </div>
        </div>
        <div className="featured-card-meta">
          <span className="badge badge-featured"><IcoStar /> Featured</span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            v{script.content_version}
          </span>
        </div>
      </div>

      <p className="featured-card-desc">{stripMarkdown(script.description) || 'No description.'}</p>

      <div className="featured-card-footer">
        <div className="featured-card-footer-left">
          <span className="meta-item">{script.install_count ?? 0} installs</span>
          <span style={{ color: 'var(--color-border-secondary)' }}>·</span>
          {script.category && (
            <span style={{ fontSize: 9.5, color: 'var(--color-text-tertiary)', background: 'var(--color-tag-bg)', border: '1px solid var(--color-border-tertiary)', padding: '1px 6px', borderRadius: 4, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
              {script.category}
            </span>
          )}
        </div>
        <span className="install-btn">Open</span>
      </div>
    </div>
  )
}

type CatalogViewProps = {
  scripts: CatalogItem[]
  highlightIds: Set<string>
  trendingIds: Set<string>
  featuredIds: Set<string>
}

function ScriptBadges({ script, trendingIds, featuredIds }: { script: CatalogItem; trendingIds: Set<string>; featuredIds: Set<string> }): React.ReactElement | null {
  const trending = trendingIds.has(script.id)
  const featured = featuredIds.has(script.id)
  const isNew = isNewScript(script.published_at)
  if (!trending && !featured && !isNew) return null
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
      {trending && <span className="badge badge-trending"><IcoTrendArrow /> Trending</span>}
      {isNew && <span className="badge badge-new">New</span>}
      {featured && !trending && !isNew && <span className="badge badge-featured"><IcoStar /> Featured</span>}
    </div>
  )
}

function CatalogGrid({ scripts, highlightIds, trendingIds, featuredIds }: CatalogViewProps): React.ReactElement {
  return (
    <div className="card-grid fade-in" aria-label="Scripts">
      {scripts.map((s) => (
        <Link
          key={s.id}
          to={`/script/${s.slug}`}
          className={`script-card${highlightIds.has(s.id) ? ' script-card-has-update' : ''}`}
        >
          <ScriptBadges script={s} trendingIds={trendingIds} featuredIds={featuredIds} />
          <div className="card-header">
            <div className="card-icon">
              <IconScriptTile />
            </div>
            <span className="card-badge">v{s.content_version}</span>
          </div>
          <div className="card-name">{s.title}</div>
          <div className="card-author">by {s.author_display_name ?? 'Author'}</div>
          <div className="card-desc line-clamp">{stripMarkdown(s.description) || 'No description.'}</div>
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
  )
}

function CatalogList({ scripts, highlightIds, trendingIds, featuredIds }: CatalogViewProps): React.ReactElement {
  return (
    <div className="row-list fade-in" aria-label="Scripts">
      {scripts.map((s) => (
        <Link
          key={s.id}
          to={`/script/${s.slug}`}
          className={`script-row${highlightIds.has(s.id) ? ' script-row-has-update' : ''}`}
        >
          <div className="row-icon">
            <IconRowScript />
          </div>
          <div className="row-info">
            <div className="row-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {s.title}
              {trendingIds.has(s.id) && <span className="badge badge-trending"><IcoTrendArrow /> Trending</span>}
              {isNewScript(s.published_at) && <span className="badge badge-new">New</span>}
            </div>
            <div className="row-desc line-clamp">
              {stripMarkdown(s.description) || 'No description.'} · by {s.author_display_name ?? 'Author'}
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
  )
}

export function HomePage(): React.ReactElement {
  const { storeSearch, storeView } = useOutletContext<VaultOutletContext>()
  const { activeGame } = useGame()
  const { items, loading, error, online, refresh } = useCatalog(activeGame)
  const [cat, setCat] = useState<string | null>(null)

  const query = storeSearch

  const categories = useMemo(() => collectCategories(items), [items])

  const filtered = useMemo(() => filterCatalog(items, cat, query), [items, cat, query])

  const catalogUpdateIds = useScriptUpdateHighlightSet(filtered, activeGame)

  const hasFilters = Boolean(cat) || query.trim().length > 0
  const summary = buildSummary(items.length, filtered.length, hasFilters)

  const featuredScripts = useMemo(() => (hasFilters ? [] : buildFeaturedList(items)), [items, hasFilters])
  const trendingIds = useMemo(() => buildTrendingSet(items, 3), [items])
  const featuredIds = useMemo(() => new Set(featuredScripts.map((s) => s.id)), [featuredScripts])

  return (
    <div className="page home-page">

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

      {error && !items.length && <p className="error">{error}</p>}

      {/* Featured section — only shown when no filter/search is active */}
      {!hasFilters && !loading && featuredScripts.length > 0 && (
        <>
          <div className="section-label" style={{ color: '#c4a96c' }}>Featured</div>
          <div className="featured-grid">
            {featuredScripts.map((s) => <FeaturedCard key={s.id} script={s} />)}
          </div>
        </>
      )}

      <div className="section-header">
        <span className="section-title">{hasFilters ? 'Results' : 'All Scripts'}</span>
        <span className="section-count" aria-live="polite">
          {loading && !items.length ? 'Loading…' : summary}
        </span>
      </div>

      {loading && !items.length ? (
        storeView === 'grid' ? (
          <div className="card-grid" aria-busy="true">
            {SKELETON_KEYS.map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="row-list" aria-busy="true">
            {SKELETON_KEYS.map((i) => <SkeletonRow key={i} />)}
          </div>
        )
      ) : storeView === 'grid' ? (
        <CatalogGrid
          scripts={filtered}
          highlightIds={catalogUpdateIds}
          trendingIds={trendingIds}
          featuredIds={featuredIds}
        />
      ) : (
        <CatalogList
          scripts={filtered}
          highlightIds={catalogUpdateIds}
          trendingIds={trendingIds}
          featuredIds={featuredIds}
        />
      )}

      {!loading && !filtered.length && (
        <p className="muted empty-state">No scripts match your search or filter.</p>
      )}
    </div>
  )
}
