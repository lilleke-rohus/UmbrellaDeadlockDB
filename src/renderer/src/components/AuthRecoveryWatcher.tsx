import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { consumeAuthDeepLinkUrl } from '../lib/consumeAuthDeepLink'
import {
  clearPasswordRecoveryRequired,
  isPasswordRecoveryEnforced,
  isPasswordRecoveryRequired,
  markPasswordRecoveryEnforced,
  markPasswordRecoveryRequired,
} from '../lib/passwordRecoveryRequirement'
import { supabase } from '../lib/supabase'

function hashLooksLikeSupabaseRecovery(): boolean {
  const { hash, search } = window.location
  return hash.includes('type=recovery') || search.includes('type=recovery')
}

async function applyDeepLinkUrl(
  url: string,
  onError: (message: string) => void,
  onRecoveryLinkConsumed: () => void
): Promise<void> {
  const { error, linkType } = await consumeAuthDeepLinkUrl(url)
  if (error) {
    onError(error)
    return
  }
  if (linkType === 'recovery') {
    onRecoveryLinkConsumed()
  }
}

/**
 * Password recovery: Supabase session from email link (custom protocol → main → IPC) or hash on http dev URL.
 */
export function AuthRecoveryWatcher(): null {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToast } = useToast()

  useEffect(() => {
    function goReset(): void {
      markPasswordRecoveryRequired()
      void navigate('/reset-password', { replace: true })
    }

    function onDeepLinkError(message: string): void {
      addToast(message, 'error')
    }

    void window.umbrella.getPendingAuthDeepLink().then((url) => {
      if (!url || !supabase) {
        return
      }
      void applyDeepLinkUrl(url, onDeepLinkError, goReset)
    })

    if (!supabase) {
      return (): void => {}
    }

    if (hashLooksLikeSupabaseRecovery()) {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          goReset()
        }
      })
    }

    const offDeepLink = window.umbrella.onAuthDeepLink((url) => {
      void applyDeepLinkUrl(url, onDeepLinkError, goReset)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        goReset()
      }
    })

    return () => {
      offDeepLink()
      subscription.unsubscribe()
    }
  }, [addToast, navigate])

  useEffect(() => {
    if (!supabase) {
      return
    }
    if (!isPasswordRecoveryRequired()) {
      return
    }
    if (location.pathname === '/reset-password') {
      if (!isPasswordRecoveryEnforced()) {
        markPasswordRecoveryEnforced()
      }
      return
    }
    if (!isPasswordRecoveryEnforced()) {
      return
    }
    clearPasswordRecoveryRequired()
    void supabase.auth.signOut().then(() => {
      void navigate('/', { replace: true })
    })
  }, [location.pathname, navigate])

  return null
}
