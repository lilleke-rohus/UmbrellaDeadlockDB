import { useEffect, useState, type FormEvent, type MouseEvent, type ReactElement } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { AuthLuxInput } from '../components/auth/AuthLuxInput'
import { APP_DISPLAY_NAME } from '../lib/appDisplayName'
import { supabaseConfigured } from '../lib/supabase'

export function LoginPage(): ReactElement {
  const { user, signIn, signUp, requestPasswordReset } = useAuth()
  const { addToast } = useToast()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [signupNotice, setSignupNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgotBusy, setForgotBusy] = useState(false)
  const [orbPos, setOrbPos] = useState({ x: 0, y: 0 })
  const [orbActive, setOrbActive] = useState(false)

  useEffect(() => {
    document.title = `${mode === 'in' ? 'Sign in' : 'Create account'} · ${APP_DISPLAY_NAME}`
  }, [mode])

  if (user) {
    return <Navigate to="/" replace />
  }

  function switchMode(next: 'in' | 'up'): void {
    setMode(next)
    setError(null)
    setSignupNotice(null)
  }

  function onPanelMouseMove(e: MouseEvent<HTMLDivElement>): void {
    const rect = e.currentTarget.getBoundingClientRect()
    setOrbPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  async function sendPasswordReset(): Promise<void> {
    setError(null)
    if (!supabaseConfigured) {
      return
    }
    setForgotBusy(true)
    try {
      const res = await requestPasswordReset(email)
      if (res.error) {
        setError(res.error)
        return
      }
      addToast('If that email is registered, we sent a reset link. Check your inbox.', 'success')
    } finally {
      setForgotBusy(false)
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    setSignupNotice(null)
    setBusy(true)
    try {
      if (mode === 'in') {
        const res = await signIn(email, password)
        setError(res.error)
        return
      }
      const res = await signUp(email, password, displayName || email.split('@')[0] || 'Author')
      setError(res.error)
      if (!res.error && res.pendingEmailConfirmation) {
        setSignupNotice(
          'Check your email for a confirmation link. After you confirm, sign in here and open Settings to set your display name and enable author tools.'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell-page">
      <div className="auth-shell-card">
        <div
          className="auth-shell-panel"
          onMouseMove={onPanelMouseMove}
          onMouseEnter={() => setOrbActive(true)}
          onMouseLeave={() => setOrbActive(false)}
        >
          <div
            className="auth-shell-orb"
            style={{
              opacity: orbActive ? 1 : 0,
              transform: `translate(${String(orbPos.x - 250)}px, ${String(orbPos.y - 250)}px)`,
            }}
          />
          <div className="auth-shell-inner">
            <header className="auth-shell-head">
              <h1 className="auth-shell-title">{mode === 'in' ? 'Sign in' : 'Create account'}</h1>
              <p className="auth-shell-hint">
                You only need an account to upload scripts. Browsing the store does not require signing in.
              </p>
            </header>

            {!supabaseConfigured ? (
              <p className="auth-shell-banner error" role="alert">
                Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (or{' '}
                <code>VITE_SUPABASE_ANON_KEY</code>) in <code>.env</code>, then restart the app.
              </p>
            ) : null}

            <form className="auth-shell-form" onSubmit={(ev) => void submit(ev)} noValidate aria-busy={busy}>
              {mode === 'up' ? (
                <AuthLuxInput
                  id="signup-display-name"
                  label="Display name"
                  placeholder="Display name"
                  value={displayName}
                  onChange={(ev) => setDisplayName(ev.target.value)}
                  autoComplete="name"
                  disabled={!supabaseConfigured}
                />
              ) : null}

              <AuthLuxInput
                id="auth-email"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                autoComplete="email"
                disabled={!supabaseConfigured}
              />
              <AuthLuxInput
                id="auth-password"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                disabled={!supabaseConfigured}
              />

              {mode === 'in' ? (
                <div className="auth-shell-forgot-wrap">
                  <button
                    type="button"
                    className="linkish auth-shell-forgot-btn"
                    disabled={forgotBusy || !supabaseConfigured}
                    onClick={() => void sendPasswordReset()}
                  >
                    {forgotBusy ? 'Sending…' : 'Forgot your password?'}
                  </button>
                </div>
              ) : (
                <span className="auth-shell-forgot-spacer" aria-hidden="true" />
              )}

              {error ? (
                <p className="error feedback auth-shell-feedback" role="alert">
                  {error}
                </p>
              ) : null}
              {signupNotice ? (
                <p className="success feedback auth-shell-feedback" role="status">
                  {signupNotice}
                </p>
              ) : null}

              <div className="auth-shell-submit-wrap">
                <button
                  type="submit"
                  className="auth-shell-submit"
                  disabled={busy || !supabaseConfigured}
                >
                  <span className="auth-shell-submit-label">
                    {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Sign up'}
                  </span>
                  <span className="auth-shell-submit-shine" aria-hidden="true">
                    <span className="auth-shell-submit-shine-bar" />
                  </span>
                </button>
              </div>
            </form>

            <p className="auth-shell-foot muted small">
              {mode === 'in' ? (
                <>
                  No account?{' '}
                  <button type="button" className="linkish" onClick={() => switchMode('up')}>
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Have an account?{' '}
                  <button type="button" className="linkish" onClick={() => switchMode('in')}>
                    Sign in
                  </button>
                </>
              )}
            </p>
            <p className="auth-shell-foot muted small">
              <Link to="/">Back to store</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
