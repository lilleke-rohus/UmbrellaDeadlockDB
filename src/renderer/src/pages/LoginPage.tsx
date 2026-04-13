import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabaseConfigured } from '../lib/supabase'

export function LoginPage(): React.ReactElement {
  const { user, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [signupNotice, setSignupNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) {
    return <Navigate to="/" replace />
  }

  function switchMode(next: 'in' | 'up'): void {
    setMode(next)
    setError(null)
    setSignupNotice(null)
  }

  async function submit(e: React.FormEvent): Promise<void> {
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
    <div className="auth-page">
      <div className="auth-card">
        <h1>{mode === 'in' ? 'Sign in' : 'Create account'}</h1>
        {!supabaseConfigured && (
          <p className="error">
            Set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (or <code>VITE_SUPABASE_ANON_KEY</code>) in{' '}
            <code>.env</code>, then restart the app.
          </p>
        )}
        <form onSubmit={(e) => void submit(e)} noValidate aria-busy={busy}>
          {mode === 'up' && (
            <label className="field" htmlFor="signup-display-name">
              <span className="field-label">Display name</span>
              <input
                id="signup-display-name"
                className="field-input"
                value={displayName}
                onChange={(ev) => setDisplayName(ev.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label className="field" htmlFor="auth-email">
            <span className="field-label">Email</span>
            <input
              id="auth-email"
              className="field-input"
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="field" htmlFor="auth-password">
            <span className="field-label">Password</span>
            <input
              id="auth-password"
              className="field-input"
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            />
          </label>
          {error && (
            <p className="error feedback" role="alert">
              {error}
            </p>
          )}
          {signupNotice && (
            <p className="success feedback" role="status">
              {signupNotice}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || !supabaseConfigured}>
            {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <p className="muted small">
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
        <p className="muted small">
          <Link to="/">Back to store</Link>
        </p>
      </div>
    </div>
  )
}
