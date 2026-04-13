import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getLastSyncedAt } from '../lib/catalogDb'
import { supabase } from '../lib/supabase'
import { runAutoUpdate } from '../lib/autoUpdate'

export function SettingsPage(): React.ReactElement {
  const { user, profile, role, refreshProfile, loading: authLoading } = useAuth()
  const [root, setRoot] = useState('')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [accountName, setAccountName] = useState('')
  const [accountBusy, setAccountBusy] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState<string | null>(null)

  const [autoUpdate, setAutoUpdate] = useState(false)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateMsg, setUpdateMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    void window.umbrella.getSettings().then((s) => {
      setRoot(s.scriptsRootPath ?? '')
      setAutoUpdate(s.autoUpdateScripts ?? false)
    })
    void getLastSyncedAt().then(setLastSync)
  }, [])

  useEffect(() => {
    if (!user) { setAccountName(''); return }
    const fromProfile = profile?.display_name
    const fromMeta = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : ''
    setAccountName((fromProfile ?? fromMeta ?? '').trim())
  }, [user, profile])

  async function pickFolder(): Promise<void> {
    const picked = await window.umbrella.pickScriptsDirectory()
    if (picked) { setRoot(picked); setMsg(null) }
  }

  async function saveRoot(): Promise<void> {
    setMsg(null)
    const res = await window.umbrella.setScriptsRoot(root.trim())
    if (!res.ok) { setMsg(res.error ?? 'Failed to save path'); return }
    setMsg('Saved scripts folder.')
  }

  async function saveDisplayName(): Promise<void> {
    if (!supabase || !user) return
    setAccountBusy(true)
    setAccountError(null)
    setAccountSuccess(null)
    try {
      const trimmed = accountName.trim()
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed || null })
        .eq('id', user.id)
      if (error) { setAccountError(error.message); return }
      await refreshProfile()
      setAccountSuccess('Display name saved.')
    } finally {
      setAccountBusy(false)
    }
  }

  async function enableAuthor(): Promise<void> {
    if (!supabase || !user) return
    setAccountBusy(true)
    setAccountError(null)
    setAccountSuccess(null)
    try {
      const { error } = await supabase.rpc('become_author')
      if (error) { setAccountError(error.message); return }
      await refreshProfile()
      setAccountSuccess('Author tools enabled — open Library in the sidebar.')
    } finally {
      setAccountBusy(false)
    }
  }

  async function changePassword(): Promise<void> {
    if (!supabase || !user) return
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return }
    setPwBusy(true)
    setPwError(null)
    setPwSuccess(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) { setPwError(error.message); return }
      setNewPassword('')
      setConfirmPassword('')
      setPwSuccess('Password updated.')
    } finally {
      setPwBusy(false)
    }
  }

  async function toggleAutoUpdate(enabled: boolean): Promise<void> {
    setAutoUpdate(enabled)
    await window.umbrella.updateSettings({ autoUpdateScripts: enabled })
  }

  async function checkNow(): Promise<void> {
    setUpdateChecking(true)
    setUpdateMsg(null)
    try {
      const result = await runAutoUpdate()
      if (result.errors.length > 0) {
        setUpdateMsg({ text: `Errors: ${result.errors.join('; ')}`, ok: false })
      } else if (result.updated === 0) {
        setUpdateMsg({ text: 'All scripts are up to date.', ok: true })
      } else {
        setUpdateMsg({ text: `Updated ${result.updated} script${result.updated !== 1 ? 's' : ''}.`, ok: true })
      }
    } catch (e) {
      setUpdateMsg({ text: e instanceof Error ? e.message : 'Update check failed', ok: false })
    } finally {
      setUpdateChecking(false)
    }
  }

  const showEnableAuthor =
    Boolean(user) && !authLoading && (profile == null || profile.role === 'reader') && !profile?.author_blocked

  return (
    <div className="page settings-page">

      {/* Account section */}
      <section className="settings-section">
        <div className="settings-section-title">Account</div>

        {user ? (
          <>
            <div className="setting-row">
              <div>
                <div className="setting-label">Signed in</div>
                <div className="setting-desc">
                  <strong>{user.email}</strong>
                  {profile ? (
                    <>
                      {' '}· role: <strong>{role}</strong>
                      {profile.verified_developer && <> · <span className="success">verified developer</span></>}
                      {profile.author_blocked && <> · <span className="error">author access blocked</span></>}
                    </>
                  ) : authLoading ? (
                    <> · loading profile…</>
                  ) : (
                    <> · profile not loaded (check database / RLS)</>
                  )}
                </div>
              </div>
            </div>

            {user && !authLoading && !profile && (
              <div className="setting-row">
                <div>
                  <div className="setting-label" style={{ color: 'var(--color-text-danger)' }}>Profile missing</div>
                  <div className="setting-desc">
                    Could not read your row in <code>public.profiles</code>. Author tools need that row (normally
                    created on sign-up by the <code>handle_new_user</code> trigger after migrations are applied).
                  </div>
                </div>
              </div>
            )}

            <div className="setting-row">
              <div>
                <div className="setting-label">Display name</div>
                <div className="setting-desc">Shown on your published scripts</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                <input
                  id="settings-display-name"
                  className="field-input"
                  style={{ width: 160 }}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="nickname"
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ height: 28, fontSize: 12 }}
                  disabled={accountBusy || !supabase}
                  onClick={() => void saveDisplayName()}
                >
                  Save
                </button>
              </div>
            </div>

            {showEnableAuthor && (
              <div className="setting-row">
                <div>
                  <div className="setting-label">Author tools</div>
                  <div className="setting-desc">
                    Create drafts and submit scripts for review. New accounts start as readers.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  style={{ height: 28, fontSize: 12, flexShrink: 0 }}
                  disabled={accountBusy || !supabase}
                  onClick={() => void enableAuthor()}
                >
                  Enable
                </button>
              </div>
            )}

            {accountError && <p className="error feedback" role="alert">{accountError}</p>}
            {accountSuccess && <p className="success feedback" role="status">{accountSuccess}</p>}
          </>
        ) : null}

        {!user && (
          <div className="setting-row">
            <div>
              <div className="setting-label">Not signed in</div>
              <div className="setting-desc">
                <Link to="/login">Sign in</Link> to manage your profile and publishing access.
              </div>
            </div>
          </div>
        )}
      </section>

      {user && (
        <section className="settings-section">
          <div className="settings-section-title">Security</div>
          <div className="setting-row">
            <div>
              <div className="setting-label">Change password</div>
              <div className="setting-desc">Must be at least 8 characters.</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
            <input
              className="field-input"
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              style={{ maxWidth: 300 }}
            />
            <input
              className="field-input"
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              style={{ maxWidth: 300 }}
            />
            <div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 28, fontSize: 12 }}
                disabled={pwBusy || !newPassword || !confirmPassword}
                onClick={() => void changePassword()}
              >
                {pwBusy ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </div>
          {pwError && <p className="error feedback" role="alert">{pwError}</p>}
          {pwSuccess && <p className="success feedback" role="status">{pwSuccess}</p>}
        </section>
      )}

      {/* Scripts folder section */}
      <section className="settings-section">
        <div className="settings-section-title">Scripts folder</div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Scripts folder path</div>
            <div className="setting-desc">
              Installed scripts are written here. Default on Windows: <code>C:\Umbrella\deadlock_scripts</code>
            </div>
          </div>
          <button
            type="button"
            className="btn"
            style={{ height: 28, fontSize: 12, flexShrink: 0 }}
            onClick={() => void pickFolder()}
          >
            Browse…
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
          <input
            id="settings-scripts-root"
            className="field-input grow"
            style={{ flex: '1 1 200px', minWidth: 0 }}
            value={root}
            onChange={(e) => setRoot(e.target.value)}
            placeholder="e.g. C:\Umbrella\deadlock_scripts"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn-primary"
            style={{ height: 28, fontSize: 12, flexShrink: 0 }}
            onClick={() => void saveRoot()}
          >
            Save
          </button>
        </div>

        {msg && (
          <p
            className={`feedback ${msg.includes('Failed') ? 'error' : 'success'}`}
            role={msg.includes('Failed') ? 'alert' : 'status'}
          >
            {msg}
          </p>
        )}
      </section>

      {/* Catalog section */}
      <section className="settings-section">
        <div className="settings-section-title">Catalog cache</div>
        <div className="setting-row">
          <div>
            <div className="setting-label">Last synced</div>
            <div className="setting-desc">
              {lastSync ? new Date(lastSync).toLocaleString() : 'Never — open the Store to sync'}
            </div>
          </div>
        </div>
        <div className="setting-row" style={{ borderBottom: 'none' }}>
          <div>
            <div className="setting-label">Offline browsing</div>
            <div className="setting-desc">
              The catalog is cached locally. Install and update still require an internet connection.
            </div>
          </div>
        </div>
      </section>

      {/* Script updates section */}
      <section className="settings-section">
        <div className="settings-section-title">Script updates</div>

        <div className="setting-row">
          <div>
            <div className="setting-label">Auto-update on launch</div>
            <div className="setting-desc">
              When the app starts, check installed scripts against the store and download any newer versions automatically.
            </div>
          </div>
          <label className="toggle-switch" style={{ flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={autoUpdate}
              onChange={(e) => void toggleAutoUpdate(e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
        </div>

        <div className="setting-row" style={{ borderBottom: 'none' }}>
          <div>
            <div className="setting-label">Check now</div>
            <div className="setting-desc">
              Manually scan all installed scripts for updates from the store.
            </div>
          </div>
          <button
            type="button"
            className="btn"
            style={{ height: 28, fontSize: 12, flexShrink: 0 }}
            disabled={updateChecking || !supabase}
            onClick={() => void checkNow()}
          >
            {updateChecking ? 'Checking…' : 'Check for updates'}
          </button>
        </div>

        {updateMsg && (
          <p
            className={`feedback ${updateMsg.ok ? 'success' : 'error'}`}
            role={updateMsg.ok ? 'status' : 'alert'}
          >
            {updateMsg.text}
          </p>
        )}
      </section>

      <section className="settings-section">
        <div className="settings-section-title">Legal &amp; information</div>
        <div className="setting-row" style={{ borderBottom: 'none', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Link to="/legal/terms" className="btn" style={{ height: 28, fontSize: 12, textDecoration: 'none' }}>
              Terms of Service
            </Link>
            <Link to="/legal/privacy" className="btn" style={{ height: 28, fontSize: 12, textDecoration: 'none' }}>
              Privacy Policy
            </Link>
          </div>
        </div>
        <p className="muted small" style={{ marginTop: 4, lineHeight: 1.5, maxWidth: 520 }}>
          This app is not affiliated with or connected to Umbrella (
          <a href="https://uc.zone" target="_blank" rel="noopener noreferrer">
            https://uc.zone
          </a>
          ) or Deadlock (Valve).
        </p>
      </section>

    </div>
  )
}
