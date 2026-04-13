import { Fragment, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ScriptRow } from '../../../shared/supabase.types'
import { useToast } from '../context/ToastContext'
import { userFacingMessage } from '../lib/userFacingError'

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  if (d === 1) return '1d ago'
  return `${d}d ago`
}

export function ModeratorPage(): React.ReactElement {
  const { addToast } = useToast()
  const [queue, setQueue] = useState<ScriptRow[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sourceCache, setSourceCache] = useState<Record<string, string>>({})

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('scripts')
      .select('*')
      .eq('status', 'pending_review')
      .order('updated_at', { ascending: true })
    if (error) {
      addToast(userFacingMessage(error), 'error')
      return
    }
    setQueue((data as ScriptRow[]) ?? [])
  }, [addToast])

  useEffect(() => { void load() }, [load])

  async function approve(id: string): Promise<void> {
    if (!supabase) return
    setBusyId(id)
    try {
      const { error } = await supabase.from('scripts').update({ status: 'published' }).eq('id', id)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      addToast('Published to the store.', 'success')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function toggleSource(id: string): Promise<void> {
    if (expandedId === id) { setExpandedId(null); return }
    if (!sourceCache[id] && supabase) {
      const { data } = await supabase.from('scripts').select('lua_source').eq('id', id).single()
      if (data?.lua_source) {
        setSourceCache((prev) => ({ ...prev, [id]: data.lua_source }))
      }
    }
    setExpandedId(id)
  }

  function startReject(id: string): void {
    setRejectingId(id)
    setRejectReason('')
  }

  async function confirmReject(): Promise<void> {
    if (!supabase || !rejectingId) return
    const reason = rejectReason.trim() || 'Rejected'
    setBusyId(rejectingId)
    try {
      const { error } = await supabase.from('scripts')
        .update({ status: 'rejected', rejected_reason: reason })
        .eq('id', rejectingId)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      addToast('Script rejected.', 'success')
      setRejectingId(null)
      setRejectReason('')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page mod-page">
      <p className="store-lead muted">Publish to the store or send back with a reason.</p>

      {rejectingId && (
        <div className="setting-block" style={{ marginBottom: 16 }}>
          <div className="setting-label" style={{ marginBottom: 8 }}>Rejection reason</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="field-input grow"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Optional — visible to author later"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') void confirmReject() }}
            />
            <button type="button" className="btn danger" onClick={() => void confirmReject()} disabled={busyId === rejectingId}>
              Confirm reject
            </button>
            <button type="button" className="btn" onClick={() => setRejectingId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="section-header" style={{ marginBottom: 10 }}>
        <span className="section-title">Scripts pending review</span>
        <button type="button" className="btn" style={{ height: 26, fontSize: 12 }} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div className="admin-scroll">
        <div className="admin-table-wrap">
          <table className="admin-table" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th>Script</th>
                <th>Slug</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td>
                      <Link to={`/script/${r.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <strong>{r.title}</strong>
                      </Link>
                      {r.description && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                          {r.description.slice(0, 80)}{r.description.length > 80 ? '…' : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                      {r.slug} · {r.filename}
                    </td>
                    <td style={{ color: 'var(--color-text-tertiary)' }}>{relativeDate(r.updated_at)}</td>
                    <td><span className="status-pill pending">Pending</span></td>
                    <td>
                      <button type="button" className="btn" style={{ height: 24, fontSize: 11 }}
                        onClick={() => void toggleSource(r.id)}>
                        {expandedId === r.id ? 'Hide' : 'Source'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ height: 24, fontSize: 11 }}
                          disabled={busyId === r.id}
                          onClick={() => void approve(r.id)}
                        >
                          Publish
                        </button>
                        <button
                          type="button"
                          className="btn"
                          style={{ height: 24, fontSize: 11, color: 'var(--color-text-danger)', borderColor: 'var(--color-border-danger)' }}
                          disabled={busyId === r.id}
                          onClick={() => startReject(r.id)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr key={`${r.id}-source`}>
                      <td colSpan={6} style={{ padding: '0 0 12px 0' }}>
                        <pre className="changelog" style={{ maxHeight: 300, overflow: 'auto', margin: 0 }}>
                          {sourceCache[r.id] ?? 'Loading…'}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!queue.length && <p className="muted empty-state">Nothing in the queue.</p>}
    </div>
  )
}
