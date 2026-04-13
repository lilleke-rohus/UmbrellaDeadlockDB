import { createClient } from '@supabase/supabase-js'
import type { ProfileRow, ScriptRow } from '../../../shared/supabase.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishable =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

export const supabaseConfigured = Boolean(url && publishable)

export const supabase =
  url && publishable
    ? createClient(url, publishable, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      })
    : null

export type { ProfileRow, ScriptRow }
