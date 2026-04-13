import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { APP_DISPLAY_NAME } from '../lib/appDisplayName'
import { supabase, supabaseConfigured } from '../lib/supabase'

const MIN_PASSWORD_LEN = 8

export function ResetPasswordPage(): ReactElement {
  const { user, loading } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = `Reset password · ${APP_DISPLAY_NAME}`
  }, [])

  if (!supabaseConfigured) {
    return <Navigate to="/login" replace />
  }

  if (!loading && !user) {
    return (
      <div className="auth-shell-page">
        <div className="auth-shell-card">
          <div className="auth-shell-panel">
            <div className="auth-shell-inner">
              <h1 className="auth-shell-title">Reset link invalid</h1>
              <p className="auth-shell-hint">
                This link is expired or was already used. Request a new reset email from the sign-in page.
              </p>
              <p className="auth-shell-foot muted small">
                <Link to="/login">Back to sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="auth-shell-page">
        <div className="page-loading">Loading…</div>
      </div>
    )
  }

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    if (!supabase) {
      return
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${String(MIN_PASSWORD_LEN)} characters.`)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password })
      if (upErr) {
        setError(upErr.message)
        return
      }
      addToast('Password updated. You can continue signed in.', 'success')
      void navigate('/', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell-page">
      <div className="auth-shell-card">
        <div className="auth-shell-panel">
          <div className="auth-shell-inner">
            <header className="auth-shell-head">
              <h1 className="auth-shell-title">Choose a new password</h1>
              <p className="auth-shell-hint">Use at least {String(MIN_PASSWORD_LEN)} characters.</p>
            </header>

            <form className="auth-shell-form" onSubmit={(ev) => void submit(ev)} noValidate aria-busy={busy}>
              <label className="field" htmlFor="reset-password">
                <span>New password</span>
                <input
                  id="reset-password"
                  className="field-input"
                  type="password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LEN}
                />
              </label>
              <label className="field" htmlFor="reset-password-confirm">
                <span>Confirm password</span>
                <input
                  id="reset-password-confirm"
                  className="field-input"
                  type="password"
                  value={confirm}
                  onChange={(ev) => setConfirm(ev.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LEN}
                />
              </label>

              {error ? (
                <p className="error feedback auth-shell-feedback" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="auth-shell-submit-wrap">
                <button type="submit" className="auth-shell-submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>

            <p className="auth-shell-foot muted small">
              <Link to="/login">Back to sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
