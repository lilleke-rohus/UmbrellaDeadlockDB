import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ScriptRow } from '../../../shared/supabase.types'

type AuthorProfile = { id: string; display_name: string | null }
type AuthorPageData = { profile: AuthorProfile | null; scripts: ScriptRow[] }

async function fetchAuthorPageData(authorId: string): Promise<AuthorPageData> {
  if (!supabase) {
    return { profile: null, scripts: [] }
  }

  const [profileResponse, scriptsResponse] = await Promise.all([
    supabase.from('profiles').select('id, display_name').eq('id', authorId).maybeSingle(),
    supabase
      .from('scripts')
      .select('id, slug, title, description, tags, category, content_version, updated_at, status, filename, author_id')
      .eq('author_id', authorId)
      .eq('status', 'published')
      .order('updated_at', { ascending: false }),
  ])

  if (profileResponse.error) {
    throw new Error(profileResponse.error.message)
  }
  if (scriptsResponse.error) {
    throw new Error(scriptsResponse.error.message)
  }

  return {
    profile: (profileResponse.data as AuthorProfile) ?? null,
    scripts: (scriptsResponse.data as ScriptRow[]) ?? [],
  }
}

export function AuthorProfilePage(): React.ReactElement {
  const { authorId } = useParams<{ authorId: string }>()
  const [profile, setProfile] = useState<AuthorProfile | null>(null)
  const [scripts, setScripts] = useState<ScriptRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!authorId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setErr(null)

    void (async () => {
      try {
        const data = await fetchAuthorPageData(authorId)
        if (cancelled) {
          return
        }
        setProfile(data.profile)
        setScripts(data.scripts)
      } catch (error) {
        if (cancelled) {
          return
        }
        setErr(error instanceof Error ? error.message : 'Failed to load author.')
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authorId])

  if (loading) return <div className="page-loading">Loading…</div>
  if (err) return <p className="error">{err}</p>
  if (!profile) {
    return (
      <div className="page">
        <p className="muted">Author not found.</p>
        <Link to="/">Store</Link>
      </div>
    )
  }

  const name = profile.display_name ?? 'Unknown Author'

  return (
    <div className="page">
      <Link to="/" className="detail-back">Store</Link>
      <h1 className="detail-title">{name}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        {scripts.length} published script{scripts.length !== 1 ? 's' : ''}
      </p>
      <div className="row-list">
        {scripts.map((s) => (
          <Link
            key={s.id}
            to={`/script/${s.slug}`}
            className="script-row"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="row-info">
              <div className="row-name">{s.title}</div>
              <div className="row-desc line-clamp">{s.description ?? s.filename}</div>
            </div>
            <div className="row-right">
              {s.tags?.slice(0, 2).map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
              <span className="meta-item muted">v{s.content_version}</span>
              <span className="install-btn">Open</span>
            </div>
          </Link>
        ))}
      </div>
      {!scripts.length && <p className="muted empty-state">No published scripts.</p>}
    </div>
  )
}
