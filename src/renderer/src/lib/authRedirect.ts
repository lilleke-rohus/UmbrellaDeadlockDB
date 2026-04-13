import { APP_AUTH_CALLBACK_URL } from '../../../shared/authDeepLink'

/**
 * URL Supabase redirects to after the user clicks the password-reset link in email.
 * Defaults to the app’s custom protocol so the **installed Electron app** opens (not a browser tab).
 *
 * Add the same value under Supabase → Authentication → URL Configuration → Redirect URLs:
 * Custom protocol callback URL (see shared auth scheme), e.g. `umbrella-deadlock-db://auth/callback`
 *
 * Override with `VITE_SUPABASE_REDIRECT_URL` only if you intentionally want a web URL instead.
 */
export function getPasswordResetRedirectTo(): string {
  const fromEnv = (import.meta.env.VITE_SUPABASE_REDIRECT_URL as string | undefined)?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }
  return APP_AUTH_CALLBACK_URL
}
