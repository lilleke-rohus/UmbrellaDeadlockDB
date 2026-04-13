import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { consumeAuthDeepLinkUrl } from '../lib/consumeAuthDeepLink'
import { supabase } from '../lib/supabase'

function hashLooksLikeSupabaseRecovery(): boolean {
  const { hash, search } = window.location
  return hash.includes('type=recovery') || search.includes('type=recovery')
}

async function applyDeepLinkUrl(
  url: string,
  onError: (message: string) => void
): Promise<void> {
  const { error } = await consumeAuthDeepLinkUrl(url)
  if (error) {
    onError(error)
  }
}

/**
 * Password recovery: Supabase session from email link (custom protocol → main → IPC) or hash on http dev URL.
 */
export function AuthRecoveryWatcher(): null {
  const navigate = useNavigate()
  const { addToast } = useToast()

  useEffect(() => {
    function onDeepLinkError(message: string): void {
      addToast(message, 'error')
    }

    void window.umbrella.getPendingAuthDeepLink().then((url) => {
      if (!url || !supabase) {
        return
      }
      void applyDeepLinkUrl(url, onDeepLinkError)
    })

    if (!supabase) {
      return (): void => {}
    }

    function goReset(): void {
      void navigate('/reset-password', { replace: true })
    }

    if (hashLooksLikeSupabaseRecovery()) {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          goReset()
        }
      })
    }

    const offDeepLink = window.umbrella.onAuthDeepLink((url) => {
      void applyDeepLinkUrl(url, onDeepLinkError)
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

  return null
}
