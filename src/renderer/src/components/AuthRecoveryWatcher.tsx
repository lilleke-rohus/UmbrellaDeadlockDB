import { useEffect, useRef } from 'react'
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
  // Some Supabase redirect variants omit `type` on custom-protocol callbacks.
  // In this app, successful auth deep links are treated as recovery unless explicitly non-recovery.
  if (linkType === 'recovery' || linkType === null) {
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
  // True while a recovery deep link is being processed. Used to intercept SIGNED_IN events
  // fired by Supabase versions that don't emit PASSWORD_RECOVERY from exchangeCodeForSession.
  const recoveryLinkProcessing = useRef(false)

  useEffect(() => {
    function goReset(): void {
      markPasswordRecoveryRequired()
      void navigate('/reset-password', { replace: true })
    }

    function onDeepLinkError(message: string): void {
      addToast(message, 'error')
    }

    function processDeepLink(url: string): void {
      recoveryLinkProcessing.current = true
      void applyDeepLinkUrl(url, onDeepLinkError, goReset).finally(() => {
        recoveryLinkProcessing.current = false
      })
    }

    void window.umbrella.getPendingAuthDeepLink().then((url) => {
      if (!url || !supabase) {
        return
      }
      processDeepLink(url)
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

    const offDeepLink = window.umbrella.onAuthDeepLink(processDeepLink)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        goReset()
      } else if (event === 'SIGNED_IN' && recoveryLinkProcessing.current) {
        // Some Supabase versions fire SIGNED_IN instead of PASSWORD_RECOVERY for recovery
        // code exchanges. Intercept it here while we know a recovery link is in flight.
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
