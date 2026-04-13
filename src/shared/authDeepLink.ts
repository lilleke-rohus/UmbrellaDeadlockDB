/** Custom protocol registered with the OS and in electron-builder (must match Supabase redirect URL). */
export const APP_AUTH_PROTOCOL_SCHEME = 'umbrella-deadlock-db' as const

/** Add this exact string to Supabase → Authentication → URL Configuration → Redirect URLs. */
export const APP_AUTH_CALLBACK_URL = `${APP_AUTH_PROTOCOL_SCHEME}://auth/callback` as const
