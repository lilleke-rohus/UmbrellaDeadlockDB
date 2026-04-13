import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { ProfileRole, ProfileRow } from '../../../shared/supabase.types'
import { supabase, supabaseConfigured } from '../lib/supabase'

export type SignUpResult = {
  error: string | null
  /** True when the project requires email confirmation and no session was issued yet. */
  pendingEmailConfirmation?: boolean
}

type AuthState = {
  user: User | null
  session: Session | null
  profile: ProfileRow | null
  loading: boolean
  role: ProfileRole
  /** True if user should see Author / studio (author+ or script coauthor). */
  canOpenAuthorStudio: boolean
  /** True while the coauthor RPC is in-flight for reader-role users. */
  canOpenAuthorStudioLoading: boolean
}

const AuthContext = createContext<
  AuthState & {
    signIn: (email: string, password: string) => Promise<{ error: string | null }>
    signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
  }
>(null as never)

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  if (!supabase) {
    return null
  }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error || !data) {
    return null
  }
  return data as ProfileRow
}

export function AuthProvider({ children }: { children: ReactNode }): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [canOpenAuthorStudio, setCanOpenAuthorStudio] = useState(false)
  const [canOpenAuthorStudioLoading, setCanOpenAuthorStudioLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) {
        return
      }
      setSession(data.session ?? null)
      if (data.session?.user) {
        void fetchProfile(data.session.user.id).then((p) => {
          if (!cancelled) {
            setProfile(p)
          }
        })
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (sess?.user) {
        void fetchProfile(sess.user.id).then(setProfile)
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session?.user) {
      setCanOpenAuthorStudio(false)
      setCanOpenAuthorStudioLoading(false)
      return
    }
    const r = profile?.role ?? 'reader'
    if (['author', 'moderator', 'admin'].includes(r)) {
      setCanOpenAuthorStudio(true)
      setCanOpenAuthorStudioLoading(false)
      return
    }
    setCanOpenAuthorStudio(false)
    setCanOpenAuthorStudioLoading(true)
    let cancelled = false
    void supabase.rpc('user_has_script_editor_access').then(({ data, error }) => {
      if (!cancelled && !error) {
        setCanOpenAuthorStudio(Boolean(data))
      }
      if (!cancelled) setCanOpenAuthorStudioLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [session?.user?.id, profile?.role, profile?.id])

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      return
    }
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) {
      setProfile(null)
      return
    }
    setProfile(await fetchProfile(uid))
  }, [])

  const value = useMemo(() => {
    const role: ProfileRole = profile?.role ?? 'reader'
    return {
      user: session?.user ?? null,
      session,
      profile,
      loading,
      role,
      canOpenAuthorStudio,
      canOpenAuthorStudioLoading,
      refreshProfile,
      signIn: async (email: string, password: string) => {
        if (!supabase) {
          return { error: 'Supabase is not configured' }
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      signUp: async (email: string, password: string, displayName: string): Promise<SignUpResult> => {
        if (!supabase) {
          return { error: 'Supabase is not configured' }
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } }
        })
        if (error) {
          return { error: error.message }
        }
        const pendingEmailConfirmation = !data.session
        return { error: null, pendingEmailConfirmation }
      },
      signOut: async () => {
        if (supabase) {
          await supabase.auth.signOut()
        }
      }
    }
  }, [session, profile, loading, refreshProfile, canOpenAuthorStudio, canOpenAuthorStudioLoading])

  if (!supabaseConfigured) {
    return (
      <AuthContext.Provider
        value={{
          user: null,
          session: null,
          profile: null,
          loading: false,
          role: 'reader',
          canOpenAuthorStudio: false,
          canOpenAuthorStudioLoading: false,
          refreshProfile: async () => {},
          signIn: async () => ({ error: 'Supabase is not configured' }),
          signUp: async () => ({ error: 'Supabase is not configured' }),
          signOut: async () => {}
        }}
      >
        {children}
      </AuthContext.Provider>
    )
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
} {
  return useContext(AuthContext)
}
