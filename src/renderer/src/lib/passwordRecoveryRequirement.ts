const RECOVERY_REQUIRED_KEY = 'auth:password-recovery-required'

export function markPasswordRecoveryRequired(): void {
  window.sessionStorage.setItem(RECOVERY_REQUIRED_KEY, '1')
}

export function clearPasswordRecoveryRequired(): void {
  window.sessionStorage.removeItem(RECOVERY_REQUIRED_KEY)
}

export function isPasswordRecoveryRequired(): boolean {
  return window.sessionStorage.getItem(RECOVERY_REQUIRED_KEY) === '1'
}
