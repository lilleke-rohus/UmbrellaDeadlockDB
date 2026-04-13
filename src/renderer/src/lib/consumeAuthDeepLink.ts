import { supabase } from './supabase'

/**
 * Applies tokens from a custom-protocol auth redirect (e.g. password recovery from email).
 */
export async function consumeAuthDeepLinkUrl(url: string): Promise<{ error: string | null }> {
  if (!supabase) {
    return { error: 'Supabase is not configured' }
  }
  const trimmed = url.trim().replace(/^"+|"+$/g, '')
  try {
    const u = new URL(trimmed)
    const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash
    const fromHash = new URLSearchParams(hash)
    let accessToken = fromHash.get('access_token')
    let refreshToken = fromHash.get('refresh_token')
    if (!accessToken || !refreshToken) {
      const fromQuery = new URLSearchParams(u.search)
      accessToken = accessToken ?? fromQuery.get('access_token')
      refreshToken = refreshToken ?? fromQuery.get('refresh_token')
    }
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      return { error: error?.message ?? null }
    }
    const code = fromHash.get('code') ?? u.searchParams.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      return { error: error?.message ?? null }
    }
    return { error: 'This sign-in link is missing credentials.' }
  } catch {
    return { error: 'Invalid sign-in link.' }
  }
}
