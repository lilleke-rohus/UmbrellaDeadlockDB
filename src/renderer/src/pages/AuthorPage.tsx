import { useCallback, useEffect, useMemo, useState, type DragEvent, type ReactElement } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { parseUmbrellaHeader, stripFirstLine } from '../lib/firstLine'
import { dedupeTags, SCRIPT_TAG_PRESETS, slugifyFilename } from '../lib/tags'
import { supabase } from '../lib/supabase'
import type { ScriptRow, ScriptStatus } from '../../../shared/supabase.types'
import type { VaultOutletContext } from '../components/Layout'
import { IconScriptTile } from '../components/NavIcons'
import { loadCachedCatalog } from '../lib/catalogDb'
import { shouldUpdate } from '../lib/scriptNeedsUpdate'
import { useScriptUpdateHighlightSet } from '../hooks/useScriptUpdateHighlight'
import { useToast } from '../context/ToastContext'
import { userFacingMessage } from '../lib/userFacingError'

type DraftForm = {
  id: string | null
  slug: string
  title: string
  filename: string
  contentVersion: string
  description: string
  category: string
  tags: string[]
  changelog: string
  body: string
  status: ScriptStatus
}

const emptyForm: DraftForm = {
  id: null,
  slug: '',
  title: '',
  filename: '',
  contentVersion: '1',
  description: '',
  category: '',
  tags: [],
  changelog: '',
  body: 'callback.on_frame:set(function()\n  -- your script\nend)\n',
  status: 'draft',
}

type TabFilter = 'all' | 'draft' | 'pending_review' | 'published'
type PageMode = 'list' | 'edit'

function statusPillClass(status: ScriptStatus): string {
  switch (status) {
    case 'draft': return ''
    case 'pending_review': return 'pending'
    case 'published': return 'active'
    case 'rejected': return 'flagged'
    default: return ''
  }
}

function statusLabel(status: ScriptStatus): string {
  switch (status) {
    case 'draft': return 'Draft'
    case 'pending_review': return 'Pending'
    case 'published': return 'Published'
    case 'rejected': return 'Rejected'
    default: return status
  }
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function parseContentVersion(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

/** Turn `my_cool-script` into a readable title (hyphens/underscores → spaces, word caps). */
function humanTitleFromStem(stem: string): string {
  const spaced = stem
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!spaced) return 'Script'
  return spaced
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function mergeFormWithLuaFile(form: DraftForm, filename: string, raw: string): DraftForm {
  const parsedHeader = parseUmbrellaHeader(raw)
  const body = parsedHeader ? stripFirstLine(raw) : raw
  const stem = filename.replace(/\.lua$/i, '')
  return {
    ...form,
    filename,
    body,
    contentVersion: parsedHeader ? String(parsedHeader.version) : form.contentVersion,
    title: form.title.trim() ? form.title : humanTitleFromStem(stem),
    slug: form.slug.trim() ? form.slug : slugifyFilename(filename),
  }
}

function LuaScriptDropCard({
  disabled,
  busy,
  filename,
  onApplyFile,
  onBrowse,
  onWrongType,
}: {
  disabled: boolean
  busy: boolean
  filename: string
  onApplyFile: (name: string, text: string) => void
  onBrowse: () => void
  onWrongType: () => void
}): ReactElement {
  const [dragDepth, setDragDepth] = useState(0)
  const dragActive = dragDepth > 0

  async function handleDrop(e: DragEvent<HTMLDivElement>): Promise<void> {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth(0)
    const f = e.dataTransfer.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.lua')) {
      onWrongType()
      return
    }
    const text = await f.text()
    onApplyFile(f.name, text)
  }

  return (
    <div
      className={`lua-drop-zone${dragActive ? ' drag-active' : ''}`}
      role="group"
      aria-label="Lua script file"
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragDepth((d) => d + 1)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragDepth((d) => Math.max(0, d - 1))
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDrop={(e) => void handleDrop(e)}
    >
      <svg className="lua-drop-zone-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M10 4v8M6 9l4-4 4 4" />
        <path d="M3 15h14" />
      </svg>
      <span className="lua-drop-zone-title">Drop .lua here</span>
      <span className="lua-drop-zone-sub">Title, slug, version, and source update from the file when fields are empty (version also reads the Umbrella header).</span>
      {filename.trim() ? (
        <span className="lua-drop-zone-file" title={filename}>
          {filename}
        </span>
      ) : null}
      <button type="button" className="btn btn-ghost lua-drop-zone-browse" disabled={disabled || busy} onClick={() => void onBrowse()}>
        Choose file…
      </button>
    </div>
  )
}

type InstalledEntry = {
  scriptId: string
  filename: string
  title: string
  description: string | null
  slug: string | null
  contentVersion: number
  installedAt: string
  needsCatalogUpdate: boolean
}

async function loadInstalledScripts(): Promise<InstalledEntry[]> {
  const [manifest, catalog] = await Promise.all([
    window.umbrella.getManifest(),
    loadCachedCatalog(),
  ])
  const catalogById = new Map(catalog.map((s) => [s.id, s]))
  return Object.values(manifest.entries).map((entry) => {
    const meta = catalogById.get(entry.scriptId)
    const needsCatalogUpdate = meta ? shouldUpdate(entry, meta) : false
    return {
      scriptId: entry.scriptId,
      filename: entry.filename,
      title: meta?.title ?? entry.filename.replace(/\.lua$/i, ''),
      description: meta?.description ?? null,
      slug: meta?.slug ?? null,
      contentVersion: entry.contentVersion,
      installedAt: entry.installedAt,
      needsCatalogUpdate,
    }
  })
}

function SkeletonCard(): React.ReactElement {
  return (
    <div className="script-card" aria-hidden>
      <div className="card-header">
        <div className="sk" style={{ width: 34, height: 34, borderRadius: 8 }} />
        <div className="sk" style={{ width: 52, height: 18, borderRadius: 20 }} />
      </div>
      <div className="sk" style={{ height: 13, width: '60%', marginTop: 10, marginBottom: 6 }} />
      <div className="sk" style={{ height: 12, width: '42%', marginBottom: 10 }} />
      <div className="sk" style={{ height: 12, width: '100%', marginBottom: 4 }} />
      <div className="sk" style={{ height: 12, width: '72%', marginBottom: 10 }} />
      <div className="card-footer">
        <div className="sk" style={{ height: 11, width: '50%' }} />
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
        <div className="sk" style={{ height: 12, width: '60%' }} />
      </div>
      <div className="row-right">
        <div className="sk" style={{ height: 22, width: 56, borderRadius: 20 }} />
        <div className="sk" style={{ height: 11, width: 64 }} />
      </div>
    </div>
  )
}

function SkeletonLibrary({ count = 4, view = 'grid' }: { count?: number; view?: 'grid' | 'list' }): React.ReactElement {
  return (
    <div className="page author-page" aria-hidden>
      <div className="sk" style={{ height: 13, width: '55%', marginBottom: 16 }} />
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div className="sk" style={{ height: 13, width: 100 }} />
        <div className="sk" style={{ height: 12, width: 60 }} />
      </div>
      {view === 'grid' ? (
        <div className="card-grid" aria-busy="true">
          {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="row-list" aria-busy="true">
          {Array.from({ length: count }, (_, i) => <SkeletonRow key={i} />)}
        </div>
      )}
    </div>
  )
}

function InstalledLibraryView(): React.ReactElement {
  const { librarySearch, libraryView } = useOutletContext<VaultOutletContext>()
  const [entries, setEntries] = useState<InstalledEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadInstalledScripts()
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!librarySearch.trim()) return entries
    const q = librarySearch.toLowerCase()
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.filename.toLowerCase().includes(q),
    )
  }, [entries, librarySearch])

  const summary =
    entries.length === 0
      ? 'Nothing installed yet.'
      : filtered.length !== entries.length
        ? `${filtered.length} of ${entries.length} scripts`
        : `${entries.length} script${entries.length === 1 ? '' : 's'} installed`

  return (
    <div className="page author-page">
      <p className="store-lead muted">
        Scripts installed on this machine. Sign in to access the author studio.
      </p>

      <div className="section-header">
        <span className="section-title">Installed scripts</span>
        <span className="section-count" aria-live="polite">
          {loading ? 'Loading…' : summary}
        </span>
      </div>

      {loading ? (
        libraryView === 'grid' ? (
          <div className="card-grid" aria-busy="true">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="row-list" aria-busy="true">
            {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
          </div>
        )
      ) : libraryView === 'grid' ? (
        <div className="card-grid fade-in" aria-label="Installed scripts">
          {filtered.map((e) => {
            const inner = (
              <>
                <div className="card-header">
                  <div className="card-icon"><IconScriptTile /></div>
                  <span className="card-badge">v{e.contentVersion}</span>
                </div>
                <div className="card-name">{e.title}</div>
                <div className="card-author">{e.filename}</div>
                {e.description && (
                  <div className="card-desc line-clamp">{e.description}</div>
                )}
                <div className="card-footer">
                  <span className="meta-item">Installed {relativeDate(e.installedAt)}</span>
                </div>
              </>
            )
            const cardClass = `script-card${e.needsCatalogUpdate ? ' script-card-has-update' : ''}`
            return e.slug ? (
              <Link key={e.scriptId} to={`/script/${e.slug}`} className={cardClass}>
                {inner}
              </Link>
            ) : (
              <div key={e.scriptId} className={cardClass}>
                {inner}
              </div>
            )
          })}
          {!loading && !filtered.length && (
            <p className="muted empty-state" style={{ gridColumn: '1/-1' }}>
              {entries.length ? 'No scripts match your search.' : 'No scripts installed yet.'}
            </p>
          )}
        </div>
      ) : (
        <div className="row-list fade-in" aria-label="Installed scripts">
          {filtered.map((e) => {
            const inner = (
              <>
                <div className="row-icon"><IconScriptTile /></div>
                <div className="row-info">
                  <div className="row-name">{e.title}</div>
                  <div className="row-desc">{e.filename}</div>
                </div>
                <div className="row-right">
                  <span className="meta-item muted">v{e.contentVersion}</span>
                  <span className="meta-item">Installed {relativeDate(e.installedAt)}</span>
                </div>
              </>
            )
            const rowClass = `script-row${e.needsCatalogUpdate ? ' script-row-has-update' : ''}`
            return e.slug ? (
              <Link key={e.scriptId} to={`/script/${e.slug}`} className={rowClass}>
                {inner}
              </Link>
            ) : (
              <div key={e.scriptId} className={rowClass}>
                {inner}
              </div>
            )
          })}
          {!loading && !filtered.length && (
            <p className="muted empty-state">
              {entries.length ? 'No scripts match your search.' : 'No scripts installed yet.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function AuthorPage(): React.ReactElement {
  const { user, canOpenAuthorStudio, canOpenAuthorStudioLoading, loading: authLoading } = useAuth()

  if (authLoading || canOpenAuthorStudioLoading) {
    return <SkeletonLibrary count={3} />
  }

  if (!user || !canOpenAuthorStudio) {
    return <InstalledLibraryView />
  }

  return <AuthorStudio />
}

function AuthorStudio(): React.ReactElement {
  const { user, role } = useAuth()
  const { addToast } = useToast()
  const canCreateScripts = ['author', 'moderator', 'admin'].includes(role)
  const { librarySearch, libraryView, libraryNewDraft, setLibraryNewDraft } =
    useOutletContext<VaultOutletContext>()

  const [mine, setMine] = useState<ScriptRow[]>([])
  const [mineLoading, setMineLoading] = useState(true)
  const [form, setForm] = useState<DraftForm>(emptyForm)
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<PageMode>('list')
  const [tabFilter, setTabFilter] = useState<TabFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const loadMine = useCallback(async () => {
    if (!supabase || !user) return
    const { data: authored, error: e1 } = await supabase
      .from('scripts')
      .select('*')
      .eq('author_id', user.id)
      .order('updated_at', { ascending: false })
    if (e1) {
      addToast(userFacingMessage(e1), 'error')
      setMineLoading(false)
      return
    }
    const list: ScriptRow[] = [...((authored as ScriptRow[]) ?? [])]
    const byId = new Map(list.map((r) => [r.id, r]))
    const { data: coRows, error: e2 } = await supabase
      .from('script_coauthors')
      .select('script_id')
      .eq('profile_id', user.id)
    if (e2) {
      addToast(userFacingMessage(e2), 'error')
      setMineLoading(false)
      return
    }
    const coIds = [...new Set((coRows ?? []).map((r: { script_id: string }) => r.script_id))]
    if (coIds.length) {
      const { data: coScripts, error: e3 } = await supabase.from('scripts').select('*').in('id', coIds)
      if (e3) {
        addToast(userFacingMessage(e3), 'error')
        setMineLoading(false)
        return
      }
      for (const row of (coScripts as ScriptRow[]) ?? []) {
        if (!byId.has(row.id)) { byId.set(row.id, row); list.push(row) }
      }
    }
    list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    setMine(list)
    setMineLoading(false)
  }, [user, addToast])

  useEffect(() => { void loadMine() }, [loadMine])

  // Trigger "New draft" from topbar button
  useEffect(() => {
    if (libraryNewDraft) {
      setForm(emptyForm)
      setTagInput('')
      setMode('edit')
      setLibraryNewDraft(false)
    }
  }, [libraryNewDraft, setLibraryNewDraft])

  const categories = useMemo(
    () => [...new Set(mine.map((r) => r.category).filter(Boolean) as string[])].sort(),
    [mine],
  )

  const filtered = useMemo(() => {
    return mine.filter((r) => {
      if (tabFilter === 'draft' && r.status !== 'draft') return false
      if (tabFilter === 'pending_review' && r.status !== 'pending_review') return false
      if (tabFilter === 'published' && r.status !== 'published') return false
      if (categoryFilter && r.category?.toLowerCase() !== categoryFilter.toLowerCase()) return false
      if (librarySearch) {
        const q = librarySearch.toLowerCase()
        if (!r.title.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [mine, tabFilter, categoryFilter, librarySearch])

  const libraryHighlightRefs = useMemo(
    () =>
      filtered.map((r) => ({
        id: r.id,
        filename: r.filename,
        content_version: r.content_version,
        updated_at: r.updated_at,
      })),
    [filtered],
  )
  const catalogUpdateIds = useScriptUpdateHighlightSet(libraryHighlightRefs)

  function openEdit(r: ScriptRow): void {
    setForm({
      id: r.id,
      slug: r.slug,
      title: r.title,
      filename: r.filename,
      contentVersion: String(r.content_version),
      description: r.description ?? '',
      category: r.category ?? '',
      tags: r.tags?.length ? [...r.tags] : [],
      changelog: r.changelog ?? '',
      body: stripFirstLine(r.lua_source),
      status: r.status,
    })
    setTagInput('')
    setMode('edit')
  }

  function openNew(): void {
    setForm(emptyForm)
    setTagInput('')
    setMode('edit')
  }

  function togglePresetTag(label: string): void {
    setForm((f) => {
      const lower = label.toLowerCase()
      const has = f.tags.some((x) => x.toLowerCase() === lower)
      return { ...f, tags: dedupeTags(has ? f.tags.filter((x) => x.toLowerCase() !== lower) : [...f.tags, label]) }
    })
  }

  function addTagFromInput(): void {
    const raw = tagInput.trim()
    if (!raw) return
    setForm((f) => ({ ...f, tags: dedupeTags([...f.tags, raw]) }))
    setTagInput('')
  }

  function removeTag(label: string): void {
    const lower = label.toLowerCase()
    setForm((f) => ({ ...f, tags: f.tags.filter((x) => x.toLowerCase() !== lower) }))
  }

  async function pickLuaFromDisk(): Promise<void> {
    const res = await window.umbrella.pickLuaScriptFile()
    if (res === null) return
    if ('error' in res) {
      addToast(res.error, 'error')
      return
    }
    setForm((f) => mergeFormWithLuaFile(f, res.filename, res.content))
  }

  async function saveDraft(): Promise<void> {
    if (!supabase || !user) return
    if (!form.id && !canCreateScripts) {
      addToast('Only primary authors can create new scripts. Coauthors can edit scripts they are assigned to.', 'error')
      return
    }
    setBusy(true)
    try {
      const contentVersion = parseContentVersion(form.contentVersion)
      if (!contentVersion) {
        addToast('Version must be a positive number (examples: 0.5, 1.2, 4.2).', 'error')
        return
      }
      const lua_source = form.body
      const tags = dedupeTags(form.tags)
      if (form.id) {
        const { error, data: updated } = await supabase.from('scripts').update({
          slug: form.slug.trim(), title: form.title.trim(), filename: form.filename.trim(),
          content_version: contentVersion,
          description: form.description.trim() || null, category: form.category.trim() || null,
          tags, changelog: form.changelog.trim() || null, lua_source,
        }).eq('id', form.id).select('content_version').single()
        if (error) {
          addToast(userFacingMessage(error), 'error')
          return
        }

        const newVersion = (updated as { content_version: number }).content_version
        if (form.changelog.trim()) {
          const { error: chErr } = await supabase.from('script_changelog').upsert(
            { script_id: form.id, version: newVersion, body: form.changelog.trim() },
            { onConflict: 'script_id,version' }
          )
          if (chErr) {
            addToast(userFacingMessage(chErr), 'error')
            return
          }
        }
      } else {
        const { data, error } = await supabase.from('scripts').insert({
          slug: form.slug.trim(), title: form.title.trim(), filename: form.filename.trim(),
          content_version: contentVersion,
          description: form.description.trim() || null, category: form.category.trim() || null,
          tags, changelog: form.changelog.trim() || null, lua_source,
          status: 'draft' as const, author_id: user.id,
        }).select('id').single()
        if (error) {
          addToast(userFacingMessage(error), 'error')
          return
        }
        setForm((f) => ({ ...f, id: (data as { id: string }).id, status: 'draft' }))
      }
      addToast('Saved draft.', 'success')
      await loadMine()
    } finally {
      setBusy(false)
    }
  }

  async function submitReview(): Promise<void> {
    if (!supabase || !form.id) {
      addToast('Save a draft first.', 'error')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.from('scripts').update({ status: 'pending_review' }).eq('id', form.id)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      setForm((f) => ({ ...f, status: 'pending_review' }))
      addToast('Submitted for review.', 'success')
      await loadMine()
    } finally {
      setBusy(false)
    }
  }

  async function deleteDraft(id: string): Promise<void> {
    if (!supabase || !confirm('Delete this draft?')) return
    const { error } = await supabase.from('scripts').delete().eq('id', id)
    if (error) {
      addToast(userFacingMessage(error), 'error')
      return
    }
    if (form.id === id) { setForm(emptyForm); setTagInput('') }
    addToast('Script deleted.', 'success')
    await loadMine()
    setMode('list')
  }

  /* ── LIST MODE ── */
  if (mode === 'list') {
    if (mineLoading) {
      return <SkeletonLibrary count={4} view={libraryView} />
    }

    return (
      <div className="page author-page fade-in">
        {!canCreateScripts && (
          <p className="store-lead muted">
            Coauthor access: open an assigned script to edit. You cannot create new drafts.
          </p>
        )}
        <div className="lib-filters">
          <div className="tab-seg">
            {(['all', 'draft', 'pending_review', 'published'] as TabFilter[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`tab-seg-btn${tabFilter === t ? ' active' : ''}`}
                onClick={() => setTabFilter(t)}
              >
                {t === 'all' ? 'All' : t === 'draft' ? 'Drafts' : t === 'pending_review' ? 'Pending' : 'Published'}
              </button>
            ))}
          </div>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-tag${categoryFilter === cat ? ' active' : ''}`}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="section-header">
          <span className="section-title">{canCreateScripts ? 'Your scripts' : 'Assigned scripts'}</span>
          <span className="section-count">{filtered.length} script{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {libraryView === 'grid' ? (
          <div className="card-grid">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`script-card${catalogUpdateIds.has(r.id) ? ' script-card-has-update' : ''}`}
                style={{ textAlign: 'left', width: '100%' }}
                onClick={() => openEdit(r)}
              >
                <div className="card-header">
                  <div className="card-icon"><IconScriptTile /></div>
                  <span className={`status-pill ${statusPillClass(r.status)}`}>{statusLabel(r.status)}</span>
                </div>
                <div className="card-name">{r.title}</div>
                <div className="card-author">
                  {r.filename}{r.category ? ` · ${r.category}` : ''}
                </div>
                {r.description && <div className="card-desc line-clamp">{r.description}</div>}
                {r.tags && r.tags.length > 0 && (
                  <div className="card-tags">
                    {r.tags.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}
                  </div>
                )}
                <div className="card-footer">
                  <span className="meta-item">Updated {relativeDate(r.updated_at)}</span>
                  <span className="install-btn">Edit</span>
                </div>
              </button>
            ))}
            {canCreateScripts && (
              <button type="button" className="upload-card" onClick={openNew}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 4v8M6 9l4-4 4 4" /><path d="M3 15h14" />
                </svg>
                <span className="upload-card-title">New draft</span>
                <span className="upload-card-sub">Create and submit scripts</span>
              </button>
            )}
            {!mine.length && (
              <p className="muted empty-state" style={{ gridColumn: '1/-1' }}>No scripts yet.</p>
            )}
          </div>
        ) : (
          <div className="row-list">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`script-row${catalogUpdateIds.has(r.id) ? ' script-row-has-update' : ''}`}
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => openEdit(r)}
              >
                <div className="row-icon"><IconScriptTile /></div>
                <div className="row-info">
                  <div className="row-name">{r.title}</div>
                  <div className="row-desc">{r.description || r.filename}</div>
                </div>
                <div className="row-right">
                  <span className={`status-pill ${statusPillClass(r.status)}`}>{statusLabel(r.status)}</span>
                  {r.tags?.slice(0, 2).map((t) => <span key={t} className="tag">{t}</span>)}
                  <span className="install-btn">Edit</span>
                </div>
              </button>
            ))}
            {canCreateScripts && (
              <button
                type="button"
                className="script-row"
                style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed', color: 'var(--color-text-tertiary)' }}
                onClick={openNew}
              >
                + New draft
              </button>
            )}
            {!mine.length && !canCreateScripts && (
              <p className="muted empty-state">No scripts assigned.</p>
            )}
          </div>
        )}
      </div>
    )
  }

  /* ── EDIT MODE ── */
  return (
    <div className="page author-page">
      <button type="button" className="author-back" onClick={() => { setMode('list') }}>
        ← Library
      </button>

      <div className="author-panel">
        <div className="settings-section-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {form.id ? 'Edit script' : 'New script'}
          {form.id && (
            <span className={`status-pill ${statusPillClass(form.status)}`}>{statusLabel(form.status)}</span>
          )}
        </div>

        <div className="draft-meta-split">
          <div className="draft-meta-fields">
            <div className="form-grid">
              <label className="field">
                <span>Slug (URL)</span>
                <input className="field-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
              </label>
              <label className="field">
                <span>Title</span>
                <input className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="field full">
                <span>Filename</span>
                <input
                  className="field-input"
                  value={form.filename}
                  onChange={(e) => setForm({ ...form, filename: e.target.value })}
                  placeholder="my_script.lua"
                />
              </label>
              <label className="field">
                <span>Version</span>
                <input
                  className="field-input"
                  type="number"
                  inputMode="numeric"
                  min={0.1}
                  step={0.1}
                  value={form.contentVersion}
                  onChange={(e) => setForm({ ...form, contentVersion: e.target.value })}
                  placeholder="1.0"
                />
              </label>
              <label className="field full">
                <span>Category</span>
                <input
                  className="field-input"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. QoL"
                />
              </label>
            </div>
          </div>
          <LuaScriptDropCard
            disabled={busy}
            busy={busy}
            filename={form.filename}
            onWrongType={() => addToast('Please drop a .lua file.', 'error')}
            onApplyFile={(name, text) => {
              setForm((f) => mergeFormWithLuaFile(f, name, text))
            }}
            onBrowse={() => void pickLuaFromDisk()}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <span className="setting-label">Tags</span>
          <div className="chips" style={{ marginTop: 6 }}>
            {SCRIPT_TAG_PRESETS.map((p) => {
              const active = form.tags.some((t) => t.toLowerCase() === p.toLowerCase())
              return (
                <button key={p} type="button" className={`chip${active ? ' active' : ''}`} onClick={() => togglePresetTag(p)}>
                  {p}
                </button>
              )
            })}
          </div>
          <div className="row gap wrap" style={{ marginTop: '0.65rem', alignItems: 'center' }}>
            <input
              className="grow field-input"
              style={{ flex: '1 1 140px' }}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagFromInput() } }}
              placeholder="Custom tag"
            />
            <button type="button" className="btn btn-ghost" onClick={() => addTagFromInput()}>Add</button>
          </div>
          {form.tags.length > 0 && (
            <ul className="tag-list" aria-label="Selected tags">
              {form.tags.map((t) => (
                <li key={t}>
                  <span className="tag-pill">
                    {t}
                    <button type="button" className="tag-remove" onClick={() => removeTag(t)} aria-label={`Remove ${t}`}>×</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="field full" style={{ marginTop: 12 }}>
          <span>Description</span>
          <textarea rows={3} className="field-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>

        <label className="field full">
          <span>Changelog</span>
          <textarea rows={2} className="field-textarea" value={form.changelog} onChange={(e) => setForm({ ...form, changelog: e.target.value })} />
        </label>

        <div className="field full">
          <span className="setting-label">Lua source</span>
          <p className="muted small" style={{ margin: '0.35rem 0 0.5rem' }}>
            Drag a file onto the panel above or use Choose file. The store header line is added automatically when you save.
          </p>
          <textarea rows={14} className="code" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </div>

        <div className="author-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveDraft()}>
            Save draft
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || !form.id || !['draft', 'rejected'].includes(form.status)}
            onClick={() => void submitReview()}
          >
            Submit for review
          </button>
          {form.id && (
            <Link to={`/script/${form.slug}`} className="btn">Store page</Link>
          )}
          {form.id && (
            <span className="muted small" style={{ alignSelf: 'center' }}>{form.status}</span>
          )}
          {form.id && ['draft'].includes(form.status) && (
            <button type="button" className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => void deleteDraft(form.id!)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
