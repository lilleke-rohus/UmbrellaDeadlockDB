import type { PostgrestError } from '@supabase/supabase-js'

function isPostgrestError(value: unknown): value is PostgrestError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as PostgrestError).message === 'string'
  )
}

/** Map Supabase / Postgres errors to short copy for toasts and inline text. */
export function userFacingMessageFromPostgrest(error: PostgrestError): string {
  const code = error.code
  const msg = error.message ?? ''

  if (code === '23505' || /duplicate key/i.test(msg)) {
    if (/slug|scripts_slug/i.test(msg)) {
      return 'That URL slug is already taken. Choose a different slug.'
    }
    if (/filename|scripts_filename/i.test(msg)) {
      return 'That filename is already used by another script.'
    }
    return 'That value already exists. Change slug or filename and try again.'
  }

  if (code === '23503') {
    return 'This action conflicts with other records (for example a missing link).'
  }

  if (code === '42501' || /permission denied|RLS/i.test(msg)) {
    return 'You do not have permission to do that.'
  }

  if (code === 'PGRST116') {
    return 'Nothing was found.'
  }

  return msg || 'Something went wrong.'
}

export function userFacingMessage(error: unknown): string {
  if (isPostgrestError(error)) {
    return userFacingMessageFromPostgrest(error)
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Something went wrong.'
}
