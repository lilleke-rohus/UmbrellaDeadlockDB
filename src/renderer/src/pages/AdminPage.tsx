import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { userFacingMessage } from '../lib/userFacingError'
import type { AdminSettingRow, ProfileRole, ScriptRow } from '../../../shared/supabase.types'
import { Modal } from '../components/Modal'

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

type ScriptListRow = Pick<ScriptRow, 'id' | 'slug' | 'title' | 'author_id' | 'status' | 'content_hash' | 'rejected_reason'> & {
  author_display_name_override?: string | null
}

const SCRIPT_STATUS_PILL_CLASS: Readonly<Record<ScriptRow['status'], string>> = {
  draft: '',
  pending_review: 'pending',
  published: 'active',
  rejected: 'flagged',
}

const SCRIPT_STATUS_LABEL: Readonly<Record<ScriptRow['status'], string>> = {
  draft: 'Draft',
  pending_review: 'Pending',
  published: 'Published',
  rejected: 'Hidden',
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

/** Store-facing author label: admin override wins, else linked profile name. */
function scriptAuthorDisplay(
  script: Pick<ScriptListRow, 'author_id' | 'author_display_name_override'>,
  profiles: AdminProfileRow[],
): string {
  const override = script.author_display_name_override?.trim()
  if (override) return override
  const profile = profiles.find((p) => p.id === script.author_id)
  const name = profile?.display_name?.trim()
  if (name) return name
  const fromEmail = profile?.email?.split('@')[0]?.trim()
  if (fromEmail) return fromEmail
  return '—'
}

export function AdminPage(): React.ReactElement {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [profiles, setProfiles] = useState<AdminProfileRow[]>([])
  const [scripts, setScripts] = useState<ScriptListRow[]>([])
  const [settings, setSettings] = useState<AdminSettingRow[]>([])
  const [coauthors, setCoauthors] = useState<CoauthorRow[]>([])
  const [busy, setBusy] = useState(false)

  const [editingScriptId, setEditingScriptId] = useState<string | null>(null)
  const [editCoProfileId, setEditCoProfileId] = useState('')
  const [editOverrideName, setEditOverrideName] = useState('')

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
      .select('id, slug, title, author_id, status, content_hash, rejected_reason, author_display_name_override')
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

  async function saveAuthorOverrideForScript(scriptId: string): Promise<void> {
    if (!supabase) {
      return
    }
    const client = supabase
    await runBusyTask(async () => {
      const value = editOverrideName.trim() || null
      const { error } = await client
        .from('scripts')
        .update({ author_display_name_override: value })
        .eq('id', scriptId)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      addToast('Author override saved.', 'success')
      await loadScripts()
    })
  }

  async function generateMissingHashes(): Promise<void> {
    if (!supabase) {
      return
    }
    const client = supabase
    await runBusyTask(async () => {
      const { data, error } = await client.rpc('admin_generate_missing_script_hashes')
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      const updatedCount = typeof data === 'number' ? data : Number(data ?? 0)
      addToast(
        updatedCount > 0
          ? `Generated ${updatedCount} missing script hash${updatedCount === 1 ? '' : 'es'}.`
          : 'All scripts already have hashes.',
        'success',
      )
      await loadScripts()
    })
  }

  async function hideScript(script: ScriptListRow): Promise<void> {
    if (!supabase) return
    const client = supabase
    await runBusyTask(async () => {
      const { error } = await client
        .from('scripts')
        .update({ status: 'rejected', rejected_reason: 'Hidden by admin' })
        .eq('id', script.id)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      addToast(`Hidden "${script.title}" from the store.`, 'success')
      await loadScripts()
    })
  }

  async function showScript(script: ScriptListRow): Promise<void> {
    if (!supabase) return
    const client = supabase
    await runBusyTask(async () => {
      const { error } = await client
        .from('scripts')
        .update({ status: 'published', rejected_reason: null })
        .eq('id', script.id)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      addToast(`Published "${script.title}" to the store.`, 'success')
      await loadScripts()
    })
  }

  async function deleteScript(script: ScriptListRow): Promise<void> {
    if (!supabase) return
    if (!confirm(`Delete "${script.title}" permanently?`)) {
      return
    }
    const client = supabase
    await runBusyTask(async () => {
      const { error } = await client.from('scripts').delete().eq('id', script.id)
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      addToast(`Deleted "${script.title}".`, 'success')
      await loadScripts()
      await loadCoauthors()
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
      setEditOverrideName('')
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

  async function addCoauthorToScript(scriptId: string): Promise<void> {
    if (!supabase || !editCoProfileId.trim()) {
      addToast('Enter a profile UUID.', 'error')
      return
    }
    const client = supabase
    await runBusyTask(async () => {
      const { error } = await client.from('script_coauthors').insert({
        script_id: scriptId,
        profile_id: editCoProfileId.trim()
      })
      if (error) {
        addToast(userFacingMessage(error), 'error')
        return
      }
      setEditCoProfileId('')
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

  const missingHashCount = useMemo(() => scripts.filter((s) => !s.content_hash).length, [scripts])
  const storeManagedScripts = useMemo(
    () => scripts.filter((script) => script.status === 'published' || script.status === 'rejected'),
    [scripts],
  )
  const editingScript = useMemo(
    () => (editingScriptId ? scripts.find((script) => script.id === editingScriptId) ?? null : null),
    [editingScriptId, scripts],
  )
  const editingScriptCoauthors = useMemo(
    () => (editingScript ? coauthors.filter((coauthor) => coauthor.script_id === editingScript.id) : []),
    [coauthors, editingScript],
  )

  const stats = useMemo(
    () => [
      { label: 'Total scripts', val: scripts.length },
      { label: 'Users', val: profiles.length },
      { label: 'Missing hashes', val: missingHashCount },
      { label: 'Coauthors', val: coauthors.length },
    ],
    [scripts.length, profiles.length, missingHashCount, coauthors.length],
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
        <div className="settings-section-title">Script hashes</div>
        <p className="setting-desc" style={{ marginBottom: 12 }}>
          Hashes are used for update checks. Generate only missing hashes without touching existing values.
        </p>
        <div className="row gap wrap" style={{ alignItems: 'center' }}>
          <span className="muted">{missingHashCount} script{missingHashCount === 1 ? '' : 's'} missing hash</span>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void generateMissingHashes()}>
            Generate missing hashes
          </button>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-title">Store visibility</div>
        <p className="setting-desc" style={{ marginBottom: 12 }}>
          Hide scripts from the store, republish hidden scripts, delete scripts, and manage store collaborators.
        </p>
        <div className="admin-scroll">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Script</th>
                  <th>Author</th>
                  <th>Status</th>
                  <th>Reason</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {storeManagedScripts.map((script) => (
                  <tr key={script.id}>
                    <td>
                      <strong>{script.title}</strong>
                    </td>
                    <td className="small">
                      {scriptAuthorDisplay(script, profiles)}
                      {script.author_display_name_override?.trim() ? (
                        <span className="muted"> (override)</span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`status-pill ${SCRIPT_STATUS_PILL_CLASS[script.status]}`}>
                        {SCRIPT_STATUS_LABEL[script.status]}
                      </span>
                    </td>
                    <td className="small muted">{script.rejected_reason ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => {
                            if (editingScriptId === script.id) {
                              setEditingScriptId(null)
                              setEditCoProfileId('')
                              setEditOverrideName('')
                              return
                            }
                            setEditingScriptId(script.id)
                            setEditCoProfileId('')
                            setEditOverrideName(script.author_display_name_override ?? '')
                          }}
                        >
                          {editingScriptId === script.id ? 'Close edit' : 'Edit'}
                        </button>
                        {script.status === 'published' ? (
                          <button type="button" className="btn" disabled={busy} onClick={() => void hideScript(script)}>
                            Hide
                          </button>
                        ) : (
                          <button type="button" className="btn" disabled={busy} onClick={() => void showScript(script)}>
                            Show
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn danger"
                          disabled={busy}
                          onClick={() => void deleteScript(script)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {!storeManagedScripts.length && <p className="muted">No published or hidden scripts.</p>}
      </section>

      <Modal
        isOpen={Boolean(editingScript)}
        title={editingScript ? `Edit script: ${editingScript.title}` : 'Edit script'}
        onClose={() => {
          setEditingScriptId(null)
          setEditCoProfileId('')
          setEditOverrideName('')
        }}
      >
        {editingScript && (
          <>
            <p className="setting-desc" style={{ marginBottom: 12 }}>
              Manage coauthors and author display override for this script.
            </p>
            <div className="setting-block">
              <div className="row gap wrap" style={{ alignItems: 'flex-end', width: '100%' }}>
                <label className="field grow" style={{ marginBottom: 0, flex: '1 1 220px' }}>
                  <span>Add coauthor (Profile UUID)</span>
                  <input
                    className="mono field-input"
                    value={editCoProfileId}
                    disabled={busy}
                    onChange={(e) => setEditCoProfileId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void addCoauthorToScript(editingScript.id)}
                >
                  Add coauthor
                </button>
              </div>
            </div>
            <ul className="co-list" style={{ marginTop: '1rem' }}>
              {editingScriptCoauthors.map((coauthor) => (
                <li key={coauthor.id} className="co-card">
                  <div>
                    <strong>{coauthor.profile_id}</strong>
                    <div className="muted small">Added {new Date(coauthor.created_at).toLocaleDateString()}</div>
                  </div>
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busy}
                    onClick={() => void removeCoauthor(coauthor.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            {!editingScriptCoauthors.length && <p className="muted">No coauthors for this script.</p>}

            <div className="setting-block" style={{ marginTop: '1rem' }}>
              <div className="row gap wrap" style={{ alignItems: 'flex-end', width: '100%' }}>
                <label className="field grow" style={{ marginBottom: 0, flex: '1 1 220px' }}>
                  <span>Author display override</span>
                  <input
                    className="field-input"
                    value={editOverrideName}
                    disabled={busy}
                    placeholder="e.g. Umbrella Team"
                    onChange={(e) => setEditOverrideName(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => void saveAuthorOverrideForScript(editingScript.id)}
                >
                  Save override
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() => void clearAuthorOverride(editingScript.id)}
                >
                  Clear override
                </button>
              </div>
            </div>
          </>
        )}
      </Modal>

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
