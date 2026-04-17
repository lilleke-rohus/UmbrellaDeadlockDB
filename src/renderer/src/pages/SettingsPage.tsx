import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getLastSyncedAt } from '../lib/catalogDb'
import { supabase } from '../lib/supabase'
import { runAutoUpdate } from '../lib/autoUpdate'
import { useToast } from '../context/ToastContext'

type UpdateMessage = { text: string; ok: boolean }

const SMALL_BUTTON_STYLE = { height: 28, fontSize: 12 } as const

function formatLastSynced(lastSync: string | null): string {
  if (!lastSync) {
    return 'Never — open the Store to sync'
  }
  return new Date(lastSync).toLocaleString()
}

function getPasswordError(newPassword: string, confirmPassword: string): string | null {
  if (newPassword.length < 8) {
    return 'Password must be at least 8 characters.'
  }
  if (newPassword !== confirmPassword) {
    return 'Passwords do not match.'
  }
  return null
}

function buildUpdateMessage(result: { updated: number; errors: string[] }): UpdateMessage {
  if (result.errors.length > 0) {
    return { text: `Errors: ${result.errors.join('; ')}`, ok: false }
  }
  if (result.updated === 0) {
    return { text: 'All scripts are up to date.', ok: true }
  }
  return { text: `Updated ${result.updated} script${result.updated !== 1 ? 's' : ''}.`, ok: true }
}

function signedInDescription(
  displayName: string | undefined,
  role: string,
  profileState: {
    profileLoaded: boolean
    verifiedDeveloper: boolean
    authorBlocked: boolean
    authLoading: boolean
  },
): React.ReactElement {
  if (!profileState.profileLoaded && profileState.authLoading) {
    return (
      <>
        <strong>{displayName}</strong> · loading profile…
      </>
    )
  }
  if (!profileState.profileLoaded) {
    return (
      <>
        <strong>{displayName}</strong> · profile not loaded (check database / RLS)
      </>
    )
  }
  return (
    <>
      <strong>{displayName}</strong> · role: <strong>{role}</strong>
      {profileState.verifiedDeveloper ? (
        <>
          {' '}
          · <span className="success">verified developer</span>
        </>
      ) : null}
      {profileState.authorBlocked ? (
        <>
          {' '}
          · <span className="error">author access blocked</span>
        </>
      ) : null}
    </>
  )
}

type AccountSectionProps = {
  user: ReturnType<typeof useAuth>['user']
  role: ReturnType<typeof useAuth>['role']
  authLoading: boolean
  profile: ReturnType<typeof useAuth>['profile']
  accountBusy: boolean
  accountError: string | null
  accountSuccess: string | null
  showEnableAuthor: boolean
  onEnableAuthor: () => void
}

function AccountSection(props: AccountSectionProps): React.ReactElement {
  const {
    user,
    role,
    authLoading,
    profile,
    accountBusy,
    accountError,
    accountSuccess,
    showEnableAuthor,
    onEnableAuthor,
  } = props

  const displayName = profile?.display_name ?? user?.user_metadata?.display_name ?? ''

  return (
    <section className="settings-section">
      <div className="settings-section-title">Account</div>

      {!user ? (
        <div className="setting-row">
          <div>
            <div className="setting-label">Not signed in</div>
            <div className="setting-desc">
              <Link to="/login">Sign in</Link> to manage your profile and publishing access.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="setting-row">
            <div>
              <div className="setting-label">Signed in</div>
              <div className="setting-desc">
                {signedInDescription(displayName, role, {
                  profileLoaded: Boolean(profile),
                  verifiedDeveloper: Boolean(profile?.verified_developer),
                  authorBlocked: Boolean(profile?.author_blocked),
                  authLoading,
                })}
              </div>
            </div>
          </div>

          {!authLoading && !profile ? (
            <div className="setting-row">
              <div>
                <div className="setting-label" style={{ color: 'var(--color-text-danger)' }}>
                  Profile missing
                </div>
                <div className="setting-desc">
                  Could not read your row in <code>public.profiles</code>. Author tools need that row (normally
                  created on sign-up by the <code>handle_new_user</code> trigger after migrations are applied).
                </div>
              </div>
            </div>
          ) : null}

          {showEnableAuthor ? (
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
                style={{ ...SMALL_BUTTON_STYLE, flexShrink: 0 }}
                disabled={accountBusy || !supabase}
                onClick={onEnableAuthor}
              >
                Enable
              </button>
            </div>
          ) : null}

          {accountError ? (
            <p className="error feedback" role="alert">
              {accountError}
            </p>
          ) : null}
          {accountSuccess ? (
            <p className="success feedback" role="status">
              {accountSuccess}
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

type SecuritySectionProps = {
  newPassword: string
  confirmPassword: string
  pwBusy: boolean
  pwError: string | null
  pwSuccess: string | null
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onChangePassword: () => void
}

function SecuritySection(props: SecuritySectionProps): React.ReactElement {
  const {
    newPassword,
    confirmPassword,
    pwBusy,
    pwError,
    pwSuccess,
    onNewPasswordChange,
    onConfirmPasswordChange,
    onChangePassword,
  } = props

  return (
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
          onChange={(e) => onNewPasswordChange(e.target.value)}
          autoComplete="new-password"
          style={{ maxWidth: 300 }}
        />
        <input
          className="field-input"
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          autoComplete="new-password"
          style={{ maxWidth: 300 }}
        />
        <div>
          <button
            type="button"
            className="btn btn-primary"
            style={SMALL_BUTTON_STYLE}
            disabled={pwBusy || !newPassword || !confirmPassword}
            onClick={onChangePassword}
          >
            {pwBusy ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </div>
      {pwError ? (
        <p className="error feedback" role="alert">
          {pwError}
        </p>
      ) : null}
      {pwSuccess ? (
        <p className="success feedback" role="status">
          {pwSuccess}
        </p>
      ) : null}
    </section>
  )
}

type ScriptsFolderSectionProps = {
  title: string
  label: string
  defaultPath: string
  root: string
  onRootChange: (value: string) => void
  onPickFolder: () => void
  onSaveRoot: () => void
}

function ScriptsFolderSection(props: ScriptsFolderSectionProps): React.ReactElement {
  const { title, label, defaultPath, root, onRootChange, onPickFolder, onSaveRoot } = props

  return (
    <section className="settings-section">
      <div className="settings-section-title">{title}</div>
      <div className="setting-row">
        <div>
          <div className="setting-label">{label}</div>
          <div className="setting-desc">
            Installed scripts are written here. Default on Windows: <code>{defaultPath}</code>
          </div>
        </div>
        <button
          type="button"
          className="btn"
          style={{ ...SMALL_BUTTON_STYLE, flexShrink: 0 }}
          onClick={onPickFolder}
        >
          Browse…
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 0' }}>
        <input
          className="field-input grow"
          style={{ flex: '1 1 200px', minWidth: 0 }}
          value={root}
          onChange={(e) => onRootChange(e.target.value)}
          placeholder={`e.g. ${defaultPath}`}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ ...SMALL_BUTTON_STYLE, flexShrink: 0 }}
          onClick={onSaveRoot}
        >
          Save
        </button>
      </div>
    </section>
  )
}

function CatalogSection({ lastSync }: { lastSync: string | null }): React.ReactElement {
  return (
    <section className="settings-section">
      <div className="settings-section-title">Catalog cache</div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Last synced</div>
          <div className="setting-desc">{formatLastSynced(lastSync)}</div>
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
  )
}

type ScriptUpdatesSectionProps = {
  autoUpdate: boolean
  updateChecking: boolean
  updateMsg: UpdateMessage | null
  onToggleAutoUpdate: (enabled: boolean) => void
  onCheckNow: () => void
}

function ScriptUpdatesSection(props: ScriptUpdatesSectionProps): React.ReactElement {
  const { autoUpdate, updateChecking, updateMsg, onToggleAutoUpdate, onCheckNow } = props

  return (
    <section className="settings-section">
      <div className="settings-section-title">Script updates</div>
      <div className="setting-row">
        <div>
          <div className="setting-label">Auto-update on launch</div>
          <div className="setting-desc">
            When the app starts, check installed scripts against the store and download any newer versions
            automatically.
          </div>
        </div>
        <label className="toggle-switch" style={{ flexShrink: 0 }}>
          <input type="checkbox" checked={autoUpdate} onChange={(e) => onToggleAutoUpdate(e.target.checked)} />
          <span className="toggle-track" />
        </label>
      </div>
      <div className="setting-row" style={{ borderBottom: 'none' }}>
        <div>
          <div className="setting-label">Check now</div>
          <div className="setting-desc">Manually scan all installed scripts for updates from the store.</div>
        </div>
        <button
          type="button"
          className="btn"
          style={{ ...SMALL_BUTTON_STYLE, flexShrink: 0 }}
          disabled={updateChecking || !supabase}
          onClick={onCheckNow}
        >
          {updateChecking ? 'Checking…' : 'Check for updates'}
        </button>
      </div>
      {updateMsg ? (
        <p className={`feedback ${updateMsg.ok ? 'success' : 'error'}`} role={updateMsg.ok ? 'status' : 'alert'}>
          {updateMsg.text}
        </p>
      ) : null}
    </section>
  )
}

function LegalSection(): React.ReactElement {
  return (
    <section className="settings-section">
      <div className="settings-section-title">Legal &amp; information</div>
      <div className="setting-row" style={{ borderBottom: 'none', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link to="/legal/terms" className="btn" style={{ ...SMALL_BUTTON_STYLE, textDecoration: 'none' }}>
            Terms of Service
          </Link>
          <Link to="/legal/privacy" className="btn" style={{ ...SMALL_BUTTON_STYLE, textDecoration: 'none' }}>
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
  )
}

export function SettingsPage(): React.ReactElement {
  const { user, profile, role, loading: authLoading } = useAuth()
  const { addToast } = useToast()
  const [root, setRoot] = useState('')
  const [dota2Root, setDota2Root] = useState('')
  const [lastSync, setLastSync] = useState<string | null>(null)
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
  const [updateMsg, setUpdateMsg] = useState<UpdateMessage | null>(null)

  useEffect(() => {
    void window.umbrella.getSettings().then((s) => {
      setRoot(s.scriptsRootPath ?? '')
      setDota2Root(s.dota2ScriptsRootPath ?? '')
      setAutoUpdate(s.autoUpdateScripts ?? false)
    })
    void getLastSyncedAt().then(setLastSync)
  }, [])

  async function pickFolder(): Promise<void> {
    const picked = await window.umbrella.pickScriptsDirectory()
    if (picked) {
      setRoot(picked)
    }
  }

  async function saveRoot(): Promise<void> {
    const res = await window.umbrella.setScriptsRoot(root.trim())
    if (!res.ok) {
      addToast(res.error ?? 'Failed to save path', 'error')
      return
    }
    addToast('Saved Deadlock scripts folder.', 'success')
  }

  async function pickDota2Folder(): Promise<void> {
    const picked = await window.umbrella.pickScriptsDirectory()
    if (picked) {
      setDota2Root(picked)
    }
  }

  async function saveDota2Root(): Promise<void> {
    const res = await window.umbrella.setDota2ScriptsRoot(dota2Root.trim())
    if (!res.ok) {
      addToast(res.error ?? 'Failed to save path', 'error')
      return
    }
    addToast('Saved Dota 2 scripts folder.', 'success')
  }

  async function enableAuthor(): Promise<void> {
    if (!supabase || !user) return
    setAccountBusy(true)
    setAccountError(null)
    setAccountSuccess(null)
    try {
      const { error } = await supabase.rpc('become_author')
      if (error) {
        setAccountError(error.message)
        return
      }
      await refreshProfile()
      setAccountSuccess('Author tools enabled — open Library in the sidebar.')
    } finally {
      setAccountBusy(false)
    }
  }

  async function changePassword(): Promise<void> {
    if (!supabase || !user) return
    const passwordError = getPasswordError(newPassword, confirmPassword)
    if (passwordError) {
      setPwError(passwordError)
      return
    }
    setPwBusy(true)
    setPwError(null)
    setPwSuccess(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setPwError(error.message)
        return
      }
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
      setUpdateMsg(buildUpdateMessage(result))
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
      <AccountSection
        user={user}
        role={role}
        authLoading={authLoading}
        profile={profile}
        accountBusy={accountBusy}
        accountError={accountError}
        accountSuccess={accountSuccess}
        showEnableAuthor={showEnableAuthor}
        onEnableAuthor={() => void enableAuthor()}
      />
      {user ? (
        <SecuritySection
          newPassword={newPassword}
          confirmPassword={confirmPassword}
          pwBusy={pwBusy}
          pwError={pwError}
          pwSuccess={pwSuccess}
          onNewPasswordChange={setNewPassword}
          onConfirmPasswordChange={setConfirmPassword}
          onChangePassword={() => void changePassword()}
        />
      ) : null}
      <ScriptsFolderSection
        title="Deadlock scripts folder"
        label="Scripts folder path"
        defaultPath="C:\Umbrella\deadlock_scripts"
        root={root}
        onRootChange={setRoot}
        onPickFolder={() => void pickFolder()}
        onSaveRoot={() => void saveRoot()}
      />
      <ScriptsFolderSection
        title="Dota 2 scripts folder"
        label="Scripts folder path"
        defaultPath="C:\Umbrella\scripts"
        root={dota2Root}
        onRootChange={setDota2Root}
        onPickFolder={() => void pickDota2Folder()}
        onSaveRoot={() => void saveDota2Root()}
      />
      <CatalogSection lastSync={lastSync} />
      <ScriptUpdatesSection
        autoUpdate={autoUpdate}
        updateChecking={updateChecking}
        updateMsg={updateMsg}
        onToggleAutoUpdate={(enabled) => void toggleAutoUpdate(enabled)}
        onCheckNow={() => void checkNow()}
      />
      <LegalSection />
    </div>
  )
}
