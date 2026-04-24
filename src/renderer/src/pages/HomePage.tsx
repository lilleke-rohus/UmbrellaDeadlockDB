import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useCatalog } from '../hooks/useCatalog'
import { useScriptUpdateHighlightSet } from '../hooks/useScriptUpdateHighlight'
import type { VaultOutletContext } from '../components/Layout'
import { IconRowScript, IconScriptTile } from '../components/NavIcons'
import { useGame } from '../context/GameContext'
import { useToast } from '../context/ToastContext'
import { scanLocalLuaScriptsWithHashes, summarizeHashCheckAgainstCatalog } from '../lib/scriptHash'
import { stripMarkdown } from '../lib/stripMarkdown'

type SortMode = 'newest' | 'oldest' | 'az' | 'za'
type CatalogItem = ReturnType<typeof useCatalog>['items'][number]

const SORT_OPTIONS: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'az', label: 'A–Z' },
  { value: 'za', label: 'Z–A' },
]

const SORT_COMPARATORS: Readonly<Record<SortMode, (left: CatalogItem, right: CatalogItem) => number>> = {
  newest: (left, right) => right.updated_at.localeCompare(left.updated_at),
  oldest: (left, right) => left.updated_at.localeCompare(right.updated_at),
  az: (left, right) => left.title.localeCompare(right.title),
  za: (left, right) => right.title.localeCompare(left.title),
}

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

function sortCatalog(items: CatalogItem[], sort: SortMode): CatalogItem[] {
  return [...items].sort(SORT_COMPARATORS[sort])
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

function isSortMode(value: string): value is SortMode {
  return value === 'newest' || value === 'oldest' || value === 'az' || value === 'za'
}

const SKELETON_KEYS = [1, 2, 3, 4, 5, 6] as const

type CatalogViewProps = {
  scripts: CatalogItem[]
  highlightIds: Set<string>
}

function CatalogGrid({ scripts, highlightIds }: CatalogViewProps): React.ReactElement {
  return (
    <div className="card-grid fade-in" aria-label="Scripts">
      {scripts.map((s) => (
        <Link
          key={s.id}
          to={`/script/${s.slug}`}
          className={`script-card${highlightIds.has(s.id) ? ' script-card-has-update' : ''}`}
        >
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

function CatalogList({ scripts, highlightIds }: CatalogViewProps): React.ReactElement {
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
            <div className="row-name">{s.title}</div>
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
  const { addToast } = useToast()
  const [cat, setCat] = useState<string | null>(null)
  const [sort, setSort] = useState<SortMode>('newest')
  const [checkingHashes, setCheckingHashes] = useState(false)
  const [hashProgress, setHashProgress] = useState<{ done: number; total: number } | null>(null)

  const query = storeSearch

  const categories = useMemo(() => collectCategories(items), [items])

  const filtered = useMemo(() => filterCatalog(items, cat, query), [items, cat, query])

  const sorted = useMemo(() => sortCatalog(filtered, sort), [filtered, sort])

  const catalogUpdateIds = useScriptUpdateHighlightSet(sorted, activeGame)

  const hasFilters = Boolean(cat) || query.trim().length > 0
  const summary = buildSummary(items.length, filtered.length, hasFilters)

  async function checkForScriptUpdates(): Promise<void> {
    if (checkingHashes) return
    setCheckingHashes(true)
    setHashProgress({ done: 0, total: 0 })
    addToast('Checking local script hashes…')
    try {
      const localScan = await scanLocalLuaScriptsWithHashes((progress) => {
        setHashProgress(progress)
      }, activeGame)
      if (localScan.error) {
        addToast(localScan.error, 'error')
        return
      }
      const result = summarizeHashCheckAgainstCatalog(localScan.scripts, items)
      addToast(
        `Hash check: ${result.current} current, ${result.outdated} need update, ${result.missingHash} missing hash, ${result.unknown} not in store.`,
        result.outdated > 0 ? 'info' : 'success',
      )
    } finally {
      setCheckingHashes(false)
    }
  }

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
            onChange={(e) => {
              const value = e.target.value
              if (isSortMode(value)) setSort(value)
            }}
            aria-label="Sort by"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {!online && (
            <span className="nav-badge" role="status" title="Offline — showing cached catalog">
              Cached
            </span>
          )}
          <button type="button" className="btn btn-compact" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh catalog'}
          </button>
          <button
            type="button"
            className="btn btn-compact"
            onClick={() => void checkForScriptUpdates()}
            disabled={checkingHashes || loading}
            title="Compare local script hashes against store versions"
          >
            {checkingHashes
              ? `Checking ${hashProgress?.done ?? 0}/${hashProgress?.total ?? 0}…`
              : 'Check for updates'}
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
            {SKELETON_KEYS.map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="row-list" aria-busy="true">
            {SKELETON_KEYS.map((i) => <SkeletonRow key={i} />)}
          </div>
        )
      ) : storeView === 'grid' ? (
        <CatalogGrid scripts={sorted} highlightIds={catalogUpdateIds} />
      ) : (
        <CatalogList scripts={sorted} highlightIds={catalogUpdateIds} />
      )}

      {!loading && !sorted.length && (
        <p className="muted empty-state">No scripts match your search or filter.</p>
      )}
    </div>
  )
}
