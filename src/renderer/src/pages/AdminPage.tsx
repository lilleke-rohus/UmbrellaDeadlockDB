import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { userFacingMessage } from '../lib/userFacingError'
import type { AdminSettingRow, ProfileRole, ScriptRow } from '../../../shared/supabase.types'

type AdminProfileRow = {
  id: string
  display_name: string | null
  role: ProfileRole
  verified_developer: boolean
  author_blocked: boolean
  author_blocked_reason: string | null
  email: string
  created_at: string
}

type CoauthorRow = {
  id: string
  script_id: string
  profile_id: string
  created_at: string
  scripts: { slug: string; title: string } | null
}

const ROLE_OPTIONS: ProfileRole[] = ['reader', 'author', 'moderator', 'admin']

type ScriptListRow = Pick<ScriptRow, 'id' | 'slug' | 'title' | 'author_id' | 'status'> & {
  author_display_name_override?: string | null
}

function normalizeCoauthorRows(data: unknown): CoauthorRow[] {
  type RawCoauthor = Omit<CoauthorRow, 'scripts'> & {
    scripts: { slug: string; title: string }[] | { slug: string; title: string } | null
  }
  return ((data as RawCoauthor[]) ?? []).map((row) => ({
    ...row,
    scripts: Array.isArray(row.scripts) ? (row.scripts[0] ?? null) : row.scripts,
  }))
}

export function AdminPage(): React.ReactElement {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([])
  const [scripts, setScripts] = useState<ScriptListRow[]>([])
  const [settings, setSettings] = useState<AdminSettingRow[]>([])
  const [coauthors, setCoauthors] = useState<CoauthorRow[]>([])
  const [busy, setBusy] = useState(false)

  const [coScriptId, setCoScriptId] = useState('')
  const [coProfileId, setCoProfileId] = useState('')

  const [overrideScriptId, setOverrideScriptId] = useState('')
  const [overrideName, setOverrideName] = useState('')

  const [setKey, setSetKey] = useState('')
  const [setValueJson, setSetValueJson] = useState('{}')

  const loadProfiles = useCallback(async () => {
    if (!supabase) {
      return
    }
    const { data, error } = await supabase.rpc('admin_list_profiles')
    if (error) {
      addToast(userFacingMessage(error), 'error')
      return
    }
    setProfiles((data as AdminProfileRow[]) ?? [])
  }, [addToast])

  const loadScripts = useCallback(async () => {
    if (!supabase) {
      return
    }
    const { data, error } = await supabase
      .from('scripts')
      .select('id, slug, title, author_id, status, author_display_name_override')
      .order('updated_at', { ascending: false })
      .limit(500)
    if (error) {
      addToast(userFacingMessage(error), 'error')
      return
    }
    setScripts((data as ScriptListRow[]) ?? [])
  }, [addToast])

  const loadSettings = useCallback(async () => {
    if (!supabase) {
      return
    }
    const { data, error } = await supabase.from('admin_settings').select('*').order('key')
    if (error) {
      addToast(userFacingMessage(error), 'error')
      return
    }
    setSettings((data as AdminSettingRow[]) ?? [])
  }, [addToast])

  const loadCoauthors = useCallback(async () => {
    if (!supabase) {
      return
    }
    const { data, error } = await supabase
      .from('script_coauthors')
      .select('id, script_id, profile_id, created_at, scripts(slug, title)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      addToast(userFacingMessage(error), 'error')
      return
    }
    setCoauthors(normalizeCoauthorRows(data))
  }, [addToast])

  const reloadAll = useCallback(async () => {
    await Promise.all([loadProfiles(), loadScripts(), loadSettings(), loadCoauthors()])
  }, [loadCoauthors, loadProfiles, loadScripts, loadSettings])

  useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  async function saveProfilePatch(
    id: string,
    patch: Partial<
      Pick<AdminProfileRow, 'verified_developer' | 'author_blocked' | 'author_blocked_reason' | 'role'>
    >
  ): Promise<void> {
    if (!supabase) {
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', id)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      await loadProfiles()
    } finally {
      setBusy(false)
    }
  }

  async function runBusyTask(task: () => Promise<void>): Promise<void> {
    setBusy(true)
    try {
      await task()
    } finally {
      setBusy(false)
    }
  }

  async function saveAuthorOverride(): Promise<void> {
    if (!supabase || !overrideScriptId) {
      addToast('Select a script first.', 'error')
      return
    }
    const client = supabase
    await runBusyTask(async () => {
      const value = overrideName.trim() || null
      const { error } = await client
        .from('scripts')
        .update({ author_display_name_override: value })
        .eq('id', overrideScriptId)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      setOverrideName('')
      setOverrideScriptId('')
      await loadScripts()
    })
  }

  async function clearAuthorOverride(id: string): Promise<void> {
    if (!supabase) return
    const client = supabase
    await runBusyTask(async () => {
      const { error } = await client
        .from('scripts')
        .update({ author_display_name_override: null })
        .eq('id', id)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      await loadScripts()
    })
  }

  async function upsertSetting(): Promise<void> {
    if (!supabase || !setKey.trim()) {
      return
    }
    const client = supabase
    let parsed: object
    try {
      parsed = JSON.parse(setValueJson) as object
    } catch {
      addToast('Setting value must be valid JSON.', 'error')
      return
    }
    await runBusyTask(async () => {
      const { error } = await client.from('admin_settings').upsert(
        {
          key: setKey.trim(),
          value: parsed as AdminSettingRow['value'],
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        },
        { onConflict: 'key' }
      )
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      setSetKey('')
      setSetValueJson('{}')
      await loadSettings()
    })
  }

  async function deleteSetting(key: string): Promise<void> {
    if (!supabase || !confirm(`Delete setting "${key}"?`)) {
      return
    }
    const client = supabase
    await runBusyTask(async () => {
      const { error } = await client.from('admin_settings').delete().eq('key', key)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      await loadSettings()
    })
  }

  async function addCoauthor(): Promise<void> {
    if (!supabase || !coScriptId || !coProfileId.trim()) {
      addToast('Choose a script and enter a profile UUID.', 'error')
      return
    }
    const client = supabase
    await runBusyTask(async () => {
      const { error } = await client.from('script_coauthors').insert({
        script_id: coScriptId,
        profile_id: coProfileId.trim()
      })
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      setCoProfileId('')
      await loadCoauthors()
    })
  }

  async function removeCoauthor(id: string): Promise<void> {
    if (!supabase || !confirm('Remove this coauthor?')) {
      return
    }
    const client = supabase
    await runBusyTask(async () => {
      const { error } = await client.from('script_coauthors').delete().eq('id', id)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      await loadCoauthors()
    })
  }

  const scriptOptions = useMemo(
    () => scripts.map((s) => ({ id: s.id, label: `${s.slug} — ${s.title}` })),
    [scripts],
  )

  const pendingCount = useMemo(() => scripts.filter((s) => s.status === 'pending_review').length, [scripts])
  const scriptsWithOverrides = useMemo(
    () => scripts.filter((script) => script.author_display_name_override),
    [scripts],
  )

  const stats = useMemo(
    () => [
      { label: 'Total scripts', val: scripts.length },
      { label: 'Users', val: profiles.length },
      { label: 'Pending review', val: pendingCount },
      { label: 'Coauthors', val: coauthors.length },
    ],
    [scripts.length, profiles.length, pendingCount, coauthors.length],
  )

  return (
    <div className="page admin-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p className="store-lead muted" style={{ margin: 0 }}>Profiles, coauthors, and JSON settings.</p>
        <button type="button" className="btn" disabled={busy} onClick={() => void reloadAll()}>
          Refresh all
        </button>
      </div>

      <div className="admin-stats">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-val">{s.val}</div>
          </div>
        ))}
      </div>

      <section className="settings-section">
        <div className="settings-section-title">Users</div>
        <p className="setting-desc" style={{ marginBottom: 12 }}>
          Toggle verified developer for trusted publishers. Block author stops self-serve enable in Settings.
        </p>
        <div className="admin-scroll">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Display</th>
                  <th>Role</th>
                  <th>Verified</th>
                  <th>Block</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="mono small">{p.email}</td>
                    <td>{p.display_name ?? '—'}</td>
                    <td>
                      <select
                        className="admin-select"
                        value={p.role}
                        disabled={busy}
                        onChange={(e) =>
                          void saveProfilePatch(p.id, { role: e.target.value as ProfileRole })
                        }
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.verified_developer}
                        disabled={busy}
                        onChange={(e) => void saveProfilePatch(p.id, { verified_developer: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={p.author_blocked}
                        disabled={busy}
                        onChange={(e) => void saveProfilePatch(p.id, { author_blocked: e.target.checked })}
                      />
                    </td>
                    <td>
                      <input
                        key={`${p.id}-reason-${p.author_blocked_reason ?? ''}`}
                        className="mono grow field-input"
                        style={{ minWidth: '8rem', width: '100%' }}
                        defaultValue={p.author_blocked_reason ?? ''}
                        disabled={busy}
                        placeholder="optional"
                        onBlur={(e) => {
                          const v = e.target.value.trim() || null
                          if (v !== (p.author_blocked_reason ?? '')) {
                            void saveProfilePatch(p.id, { author_blocked_reason: v })
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {!profiles.length && <p className="muted">No rows (or not an admin).</p>}
      </section>

      <section className="settings-section">
        <div className="settings-section-title">Coauthors</div>
        <p className="setting-desc" style={{ marginBottom: 12 }}>
          Paste the user&apos;s profile UUID from the table above.
        </p>
        <div className="setting-block">
          <div className="row gap wrap" style={{ alignItems: 'flex-end', width: '100%' }}>
            <label className="field" style={{ marginBottom: 0, minWidth: '12rem', flex: '1 1 200px' }}>
              <span>Script</span>
              <select
                className="admin-select wide"
                value={coScriptId}
                disabled={busy}
                onChange={(e) => setCoScriptId(e.target.value)}
              >
                <option value="">Select…</option>
                {scriptOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field grow" style={{ marginBottom: 0, flex: '1 1 220px' }}>
              <span>Profile UUID</span>
              <input
                className="mono field-input"
                value={coProfileId}
                disabled={busy}
                onChange={(e) => setCoProfileId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void addCoauthor()}>
              Add
            </button>
          </div>
        </div>
        <ul className="co-list" style={{ marginTop: '1rem' }}>
          {coauthors.map((c) => (
            <li key={c.id} className="co-card">
              <div>
                <strong>{c.scripts?.title ?? c.script_id}</strong>
                <span className="muted small"> · {c.scripts?.slug}</span>
                <div className="muted small mono" style={{ marginTop: '0.25rem' }}>
                  {c.profile_id}
                </div>
              </div>
              <button type="button" className="btn danger" disabled={busy} onClick={() => void removeCoauthor(c.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        {!coauthors.length && <p className="muted">No coauthors.</p>}
      </section>

      <section className="settings-section">
        <div className="settings-section-title">Author name overrides</div>
        <p className="setting-desc" style={{ marginBottom: 12 }}>
          Override the displayed author name on any script. Leave blank to clear and restore the real name.
        </p>
        <div className="setting-block">
          <div className="row gap wrap" style={{ alignItems: 'flex-end', width: '100%' }}>
            <label className="field" style={{ marginBottom: 0, minWidth: '12rem', flex: '1 1 200px' }}>
              <span>Script</span>
              <select
                className="admin-select wide"
                value={overrideScriptId}
                disabled={busy}
                onChange={(e) => {
                  const id = e.target.value
                  setOverrideScriptId(id)
                  const existing = scripts.find((s) => s.id === id)?.author_display_name_override ?? ''
                  setOverrideName(existing ?? '')
                }}
              >
                <option value="">Select…</option>
                {scriptOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="field grow" style={{ marginBottom: 0, flex: '1 1 180px' }}>
              <span>Display name override</span>
              <input
                className="field-input"
                value={overrideName}
                disabled={busy}
                placeholder="e.g. Umbrella Team"
                onChange={(e) => setOverrideName(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveAuthorOverride()}>
              Save
            </button>
          </div>
        </div>
        {scriptsWithOverrides.length > 0 && (
          <ul className="co-list" style={{ marginTop: '1rem' }}>
            {scriptsWithOverrides.map((s) => (
                <li key={s.id} className="co-card">
                  <div>
                    <strong>{s.title}</strong>
                    <span className="muted small"> · {s.slug}</span>
                    <div className="muted small" style={{ marginTop: '0.25rem' }}>
                      Showing as: <strong>{s.author_display_name_override}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busy}
                    onClick={() => void clearAuthorOverride(s.id)}
                  >
                    Clear
                  </button>
                </li>
              ))}
          </ul>
        )}
        {!scriptsWithOverrides.length && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>No overrides set.</p>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-title">JSON settings</div>
        <p className="setting-desc" style={{ marginBottom: 12 }}>
          Example keys: <code>store_notice</code>, <code>allow_signups</code>.
        </p>
        <div className="setting-block">
          <div className="row gap wrap" style={{ alignItems: 'flex-end', width: '100%' }}>
            <label className="field" style={{ marginBottom: 0, flex: '1 1 140px' }}>
              <span>Key</span>
              <input
                className="field-input"
                value={setKey}
                disabled={busy}
                onChange={(e) => setSetKey(e.target.value)}
                placeholder="my_setting"
              />
            </label>
            <label className="field grow" style={{ marginBottom: 0, flex: '2 1 240px' }}>
              <span>Value (JSON)</span>
              <input
                className="mono field-input"
                value={setValueJson}
                disabled={busy}
                onChange={(e) => setSetValueJson(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void upsertSetting()}>
              Save
            </button>
          </div>
        </div>
        <ul className="co-list" style={{ marginTop: '1rem' }}>
          {settings.map((s) => (
            <li key={s.key} className="co-card">
              <div style={{ minWidth: 0 }}>
                <strong className="mono">{s.key}</strong>
                <pre className="settings-json">{JSON.stringify(s.value, null, 2)}</pre>
              </div>
              <button type="button" className="btn danger" disabled={busy} onClick={() => void deleteSetting(s.key)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
        {!settings.length && <p className="muted">No settings rows.</p>}
      </section>
    </div>
  )
}
