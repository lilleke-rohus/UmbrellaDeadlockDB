import { supabase } from './supabase'

export type ConsumeAuthDeepLinkResult = {
  error: string | null
  linkType: string | null
}

function extractLinkType(url: URL, hashParams: URLSearchParams): string | null {
  const rawType = hashParams.get('type') ?? url.searchParams.get('type')
  const normalized = rawType?.trim().toLowerCase()
  return normalized ? normalized : null
}

/**
 * Applies tokens from a custom-protocol auth redirect (e.g. password recovery from email).
 */
export async function consumeAuthDeepLinkUrl(url: string): Promise<ConsumeAuthDeepLinkResult> {
  if (!supabase) {
    return { error: 'Supabase is not configured', linkType: null }
  }
  const trimmed = url.trim().replace(/^"+|"+$/g, '')
  try {
    const u = new URL(trimmed)
    const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash
    const fromHash = new URLSearchParams(hash)
    const linkType = extractLinkType(u, fromHash)
    let accessToken = fromHash.get('access_token')
    let refreshToken = fromHash.get('refresh_token')
    if (!accessToken || !refreshToken) {
      const fromQuery = new URLSearchParams(u.search)
      accessToken = accessToken ?? fromQuery.get('access_token')
      refreshToken = refreshToken ?? fromQuery.get('refresh_token')
    }
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      return { error: error?.message ?? null, linkType }
    }
    const code = fromHash.get('code') ?? u.searchParams.get('code')
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      return { error: error?.message ?? null, linkType }
    }
    return { error: 'This sign-in link is missing credentials.', linkType }
  } catch {
    return { error: 'Invalid sign-in link.', linkType: null }
  }
}
