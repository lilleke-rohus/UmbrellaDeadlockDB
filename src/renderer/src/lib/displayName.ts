import { supabase } from './supabase'

export const DISPLAY_NAME_TAKEN_MESSAGE = 'That display name is already taken.'
const FAKE_EMAIL_DOMAIN = 'umbrella.db.internal'

export function normalizeDisplayName(value: string): string {
  return value.trim()
}

export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Display name is required.'
  if (!/^[a-zA-Z0-9 ]+$/.test(trimmed)) return 'Display name may only contain letters, numbers, and spaces.'
  if (trimmed.length > 32) return 'Display name must be 32 characters or fewer.'
  return null
}

export function toFakeEmail(displayName: string): string {
  const slug = displayName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  return `${slug}@${FAKE_EMAIL_DOMAIN}`
}

export function isDisplayNameConflictError(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  return (
    (normalized.includes('duplicate key value') && normalized.includes('display_name')) ||
    normalized.includes('already taken')
  )
}

export async function isDisplayNameTaken(
  displayName: string,
  opts?: { excludeUserId?: string }
): Promise<{ taken: boolean; error: string | null }> {
  if (!supabase) {
    return { taken: false, error: 'Supabase is not configured' }
  }
  const normalized = normalizeDisplayName(displayName)
  if (!normalized) {
    return { taken: false, error: null }
  }
  const excludeUserId = opts?.excludeUserId
  let query = supabase.from('profiles').select('id').ilike('display_name', normalized).limit(1)
  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }
  const { data, error } = await query
  if (error) {
    return { taken: false, error: error.message }
  }
  return { taken: (data?.length ?? 0) > 0, error: null }
}
